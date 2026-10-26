import { UpdateType } from "@powersync/web"
import { describe, expect, it, vi } from "vitest"

import {
  BATCH_ROWS,
  createConnector,
  type Refusal,
  serverTable,
  uploadEntries,
  uploadRuns,
} from "@/backup/connector"

type Answer = { error: { code: string } | null; status: number }

/**
 * A fake Supabase client: records every request and answers each with
 * `answer(table, op, rows)`, by default a success.
 */
function fakeClient(
  answer: (table: string, op: string, rows: unknown) => Answer = () => ({
    error: null,
    status: 201,
  }),
  userId = "user-1",
) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const from = (table: string) => {
    const record =
      (op: string) =>
      (...args: unknown[]) => {
        calls.push({ table, op, args })
        const result = () => answer(table, op, args[0])
        const chain = {
          eq: (...eqArgs: unknown[]) => {
            calls.push({ table, op: "eq", args: eqArgs })
            return Promise.resolve(result())
          },
          setHeader: (...headerArgs: unknown[]) => {
            calls.push({ table, op: "header", args: headerArgs })
            return chain
          },
          then: (resolve: (value: unknown) => void) => resolve(result()),
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
    user: { id: userId },
  }
  return {
    calls,
    client: {
      from,
      auth: { getSession: async () => ({ data: { session }, error: null }) },
    } as never,
  }
}

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseKey: "sb_publishable_example",
  powersyncUrl: "https://example.powersync.journeyapps.com",
}

let clientId = 0
const entry = (
  op: UpdateType,
  opData?: Record<string, unknown>,
  table = "synced_students",
  id = `row-${++clientId}`,
) => ({ op, table, id, opData, clientId })

function queue(crud: ReturnType<typeof entry>[]) {
  const complete = vi.fn(async () => {})
  return {
    complete,
    database: {
      getNextCrudTransaction: async () => ({ crud, complete }),
    } as never,
  }
}

function reports() {
  const recorded: Refusal[][] = []
  const outdated: boolean[] = []
  return {
    recorded,
    outdated,
    reports: {
      recordRefusals: async (refusals: Refusal[]) => {
        recorded.push(refusals)
      },
      onOutdated: (value: boolean) => outdated.push(value),
    },
  }
}

describe("the backup connector", () => {
  it("maps synced tables to their server tables and refuses others", () => {
    expect(serverTable("synced_dutySettingItems")).toBe("dutySettingItems")
    expect(() => serverTable("meta")).toThrow("Not a synced table: meta")
  })

  it("upserts a PUT, updates a PATCH and deletes a DELETE by id, each with its transaction's token", async () => {
    const { client, calls } = fakeClient()
    const put = entry(UpdateType.PUT, { firstName: "Ada" }, undefined, "s-1")
    const patch = entry(
      UpdateType.PATCH,
      { firstName: "Eva" },
      undefined,
      "s-1",
    )
    const remove = entry(UpdateType.DELETE, undefined, undefined, "s-1")
    for (const change of [put, patch, remove])
      await uploadEntries(client, [change], "token-1")
    const header = {
      table: "students",
      op: "header",
      args: ["Authorization", "Bearer token-1"],
    }
    expect(calls).toEqual([
      {
        table: "students",
        op: "upsert",
        args: [[{ firstName: "Ada", id: "s-1" }]],
      },
      header,
      { table: "students", op: "update", args: [{ firstName: "Eva" }] },
      header,
      { table: "students", op: "eq", args: ["id", "s-1"] },
      { table: "students", op: "delete", args: [] },
      header,
      { table: "students", op: "eq", args: ["id", "s-1"] },
    ])
  })

  it("groups consecutive inserts into one table, in queue order", () => {
    const course = entry(UpdateType.PUT, {}, "synced_courses")
    const students = Array.from({ length: BATCH_ROWS + 2 }, () =>
      entry(UpdateType.PUT, {}),
    )
    const patch = entry(UpdateType.PATCH, {})
    const later = entry(UpdateType.PUT, {})
    const runs = uploadRuns([course, ...students, patch, later])
    expect(runs.map((run) => run.length)).toEqual([1, BATCH_ROWS, 2, 1, 1])
    expect(runs.flat()).toEqual([course, ...students, patch, later])
  })

  it("asks for the current session's token at every request", async () => {
    const { client } = fakeClient()
    const connector = createConnector(
      client,
      config,
      "user-1",
      reports().reports,
    )
    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: config.powersyncUrl,
      token: "token-1",
      expiresAt: new Date(1_900_000_000 * 1000),
    })
  })
})

describe("what an upload does with each answer (B4)", () => {
  it("completes a written transaction and records nothing", async () => {
    const { client } = fakeClient()
    const { complete, database } = queue([
      entry(UpdateType.PUT, { firstName: "Ada" }),
    ])
    const seen = reports()
    await createConnector(client, config, "user-1", seen.reports).uploadData(
      database,
    )
    expect(complete).toHaveBeenCalledTimes(1)
    expect(seen.recorded).toEqual([[]])
  })

  it("keeps the transaction queued on a transient failure, saying nothing about the row", async () => {
    const { client } = fakeClient(() => ({ error: { code: "" }, status: 503 }))
    const { complete, database } = queue([
      entry(UpdateType.PUT, { firstName: "Ada" }),
    ])
    const seen = reports()
    const upload = createConnector(
      client,
      config,
      "user-1",
      seen.reports,
    ).uploadData(database)
    await expect(upload).rejects.toThrow(
      "The backup did not answer; the change stays queued",
    )
    expect(complete).not.toHaveBeenCalled()
    expect(seen.recorded).toEqual([])
  })

  it("stops for an app older than the server's minimum and reports it", async () => {
    const { client } = fakeClient(() => ({
      error: { code: "CVOLD" },
      status: 400,
    }))
    const { complete, database } = queue([entry(UpdateType.PATCH, { a: 1 })])
    const seen = reports()
    await expect(
      createConnector(client, config, "user-1", seen.reports).uploadData(
        database,
      ),
    ).rejects.toThrow("newer app")
    expect(seen.outdated).toEqual([true])
    expect(complete).not.toHaveBeenCalled()
  })

  it("keeps a refused change with its data and lets the rest of the queue through", async () => {
    const refusedRow = "bad-row"
    const { client, calls } = fakeClient((_table, op, rows) => {
      const ids = Array.isArray(rows)
        ? rows.map((row: { id: string }) => row.id)
        : []
      return op === "upsert" && ids.includes(refusedRow)
        ? { error: { code: "23502" }, status: 400 }
        : { error: null, status: 201 }
    })
    const good = entry(UpdateType.PUT, { firstName: "Ada" })
    const bad = entry(
      UpdateType.PUT,
      { firstName: "Eva" },
      undefined,
      refusedRow,
    )
    const after = entry(UpdateType.PATCH, { firstName: "Ida" })
    const { complete, database } = queue([good, bad, after])
    const seen = reports()
    await createConnector(client, config, "user-1", seen.reports).uploadData(
      database,
    )
    // The run of two failed whole, so each went alone; the PATCH went after.
    expect(calls.filter(({ op }) => op === "upsert")).toHaveLength(3)
    expect(calls.some(({ op }) => op === "update")).toBe(true)
    expect(seen.recorded).toEqual([
      [
        {
          id: `refusal:${bad.clientId}`,
          tableName: "students",
          rowId: refusedRow,
          op: UpdateType.PUT,
          data: { firstName: "Eva" },
          reason: "data",
          refusedAt: expect.any(String),
        },
      ],
    ])
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("reports a course id another account already holds", async () => {
    const { client } = fakeClient((table) =>
      table === "courses"
        ? { error: { code: "42501" }, status: 403 }
        : { error: null, status: 201 },
    )
    const { database } = queue([entry(UpdateType.PUT, {}, "synced_courses")])
    const seen = reports()
    await createConnector(client, config, "user-1", seen.reports).uploadData(
      database,
    )
    expect(seen.recorded[0]?.[0]?.reason).toBe("other-account")
  })
})

describe("a connector that outlives its account", () => {
  it("fetches no token and uploads nothing for another account", async () => {
    const { client, calls } = fakeClient()
    const connector = createConnector(
      client,
      config,
      "user-2",
      reports().reports,
    )
    await expect(connector.fetchCredentials()).resolves.toBeNull()
    const { complete, database } = queue([
      entry(UpdateType.PUT, { firstName: "Ada" }),
    ])
    await expect(connector.uploadData(database)).rejects.toThrow(
      "Not signed in as this device's account",
    )
    expect(calls).toEqual([])
    expect(complete).not.toHaveBeenCalled()
  })
})
