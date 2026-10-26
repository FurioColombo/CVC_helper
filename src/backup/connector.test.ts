import { UpdateType } from "@powersync/web"
import { describe, expect, it, vi } from "vitest"

import { createConnector, serverTable, uploadEntry } from "@/backup/connector"

function fakeClient(error: unknown = null) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const from = (table: string) => {
    const record =
      (op: string) =>
      (...args: unknown[]) => {
        calls.push({ table, op, args })
        const chain = {
          eq: (...eqArgs: unknown[]) => {
            calls.push({ table, op: "eq", args: eqArgs })
            return Promise.resolve({ error })
          },
          then: (resolve: (value: unknown) => void) => resolve({ error }),
        }
        return chain
      }
    return {
      upsert: record("upsert"),
      update: record("update"),
      delete: record("delete"),
    }
  }
  const session = {
    access_token: "token-1",
    expires_at: 1_900_000_000,
    user: { id: "user-1" },
  }
  return {
    calls,
    client: {
      from,
      auth: { getSession: async () => ({ data: { session }, error: null }) },
    } as never,
  }
}

const entry = (op: UpdateType, opData?: Record<string, unknown>) => ({
  op,
  table: "synced_students",
  id: "student-1",
  opData,
})

describe("the backup connector", () => {
  it("maps synced tables to their server tables and refuses others", () => {
    expect(serverTable("synced_dutySettingItems")).toBe("dutySettingItems")
    expect(() => serverTable("meta")).toThrow("Not a synced table: meta")
  })

  it("upserts a PUT, updates a PATCH and deletes a DELETE by id", async () => {
    const { client, calls } = fakeClient()
    await uploadEntry(client, entry(UpdateType.PUT, { firstName: "Ada" }))
    await uploadEntry(client, entry(UpdateType.PATCH, { firstName: "Eva" }))
    await uploadEntry(client, entry(UpdateType.DELETE))
    expect(calls).toEqual([
      {
        table: "students",
        op: "upsert",
        args: [{ firstName: "Ada", id: "student-1" }],
      },
      { table: "students", op: "update", args: [{ firstName: "Eva" }] },
      { table: "students", op: "eq", args: ["id", "student-1"] },
      { table: "students", op: "delete", args: [] },
      { table: "students", op: "eq", args: ["id", "student-1"] },
    ])
  })

  it("keeps a failed transaction queued and completes a written one", async () => {
    for (const [error, completed] of [
      [{ code: "42501" }, false],
      [null, true],
    ] as const) {
      const { client } = fakeClient(error)
      const complete = vi.fn(async () => {})
      const database = {
        getNextCrudTransaction: async () => ({
          crud: [entry(UpdateType.PUT, { firstName: "Ada" })],
          complete,
        }),
      } as never
      const connector = createConnector(
        client,
        {
          supabaseUrl: "https://example.supabase.co",
          supabaseKey: "sb_publishable_example",
          powersyncUrl: "https://example.powersync.journeyapps.com",
        },
        "user-1",
      )
      const upload = connector.uploadData(database)
      if (completed) await upload
      else await expect(upload).rejects.toEqual({ code: "42501" })
      expect(complete).toHaveBeenCalledTimes(completed ? 1 : 0)
    }
  })

  it("asks for the current session's token at every request", async () => {
    const { client } = fakeClient()
    const connector = createConnector(
      client,
      {
        supabaseUrl: "https://example.supabase.co",
        supabaseKey: "sb_publishable_example",
        powersyncUrl: "https://example.powersync.journeyapps.com",
      },
      "user-1",
    )
    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: "https://example.powersync.journeyapps.com",
      token: "token-1",
      expiresAt: new Date(1_900_000_000 * 1000),
    })
  })
})

describe("a connector that outlives its account", () => {
  it("fetches no token and uploads nothing for another account", async () => {
    const { client, calls } = fakeClient()
    const connector = createConnector(
      client,
      {
        supabaseUrl: "https://example.supabase.co",
        supabaseKey: "sb_publishable_example",
        powersyncUrl: "https://example.powersync.journeyapps.com",
      },
      "user-2",
    )
    await expect(connector.fetchCredentials()).resolves.toBeNull()
    const complete = vi.fn(async () => {})
    await expect(
      connector.uploadData({
        getNextCrudTransaction: async () => ({
          crud: [entry(UpdateType.PUT, { firstName: "Ada" })],
          complete,
        }),
      } as never),
    ).rejects.toThrow("Not signed in as this device's account")
    expect(calls).toEqual([])
    expect(complete).not.toHaveBeenCalled()
  })
})
