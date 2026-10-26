import { UpdateType } from "@powersync/web"
import { describe, expect, it, vi } from "vitest"

import {
  BATCH_ROWS,
  createConnector,
  serverTable,
  type UploadOutcome,
  uploadEntries,
  uploadRuns,
} from "@/backup/connector"

type Answer = {
  error: { code: string } | null
  status: number
  /** Ids the server changed; by default every id the request names. */
  changed?: string[]
}
type Call = { table: string; op: string; args: unknown[] }

/**
 * A fake Supabase client: records every request and answers each with
 * `answer(table, op, ids)`, by default a success that changed every row.
 * `exists` says which rows a lookup finds.
 */
function fakeClient(
  answer: (table: string, op: string, ids: string[]) => Answer = () => ({
    error: null,
    status: 201,
  }),
  exists: (id: string) => boolean = () => false,
  userId = "user-1",
) {
  const calls: Call[] = []
  const from = (table: string) => {
    const chain = (op: string, ids: string[]) => {
      const self = {
        eq: (...args: unknown[]) => {
          calls.push({ table, op: "eq", args })
          ids.push(String(args[1]))
          return self
        },
        lte: (...args: unknown[]) => {
          calls.push({ table, op: "lte", args })
          return self
        },
        setHeader: (...args: unknown[]) => {
          calls.push({ table, op: "header", args })
          return self
        },
        select: (...args: unknown[]) => {
          calls.push({ table, op: `${op}:select`, args })
          return self
        },
        then: (resolve: (value: unknown) => void) => {
          if (op === "lookup")
            return resolve({
              data: ids.filter(exists).map((id) => ({ id })),
              error: null,
              status: 200,
            })
          const result = answer(table, op, ids)
          resolve({
            error: result.error,
            status: result.status,
            data: result.error
              ? null
              : (result.changed ?? ids).map((id) => ({ id })),
          })
        },
      }
      return self
    }
    return {
      upsert: (rows: Array<{ id: string }>) => {
        calls.push({ table, op: "upsert", args: [rows] })
        return chain(
          "upsert",
          rows.map(({ id }) => id),
        )
      },
      update: (data: unknown) => {
        calls.push({ table, op: "update", args: [data] })
        return chain("update", [])
      },
      delete: () => {
        calls.push({ table, op: "delete", args: [] })
        return chain("delete", [])
      },
      select: (...args: unknown[]) => {
        calls.push({ table, op: "lookup", args })
        return chain("lookup", [])
      },
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
const COLUMNS = ["firstName", "courseNote", "updatedAt"]

let clientId = 0
const entry = (
  op: UpdateType,
  opData?: Record<string, unknown>,
  table = "synced_students",
  id = `row-${++clientId}`,
  previousValues?: Record<string, unknown>,
) => ({ op, table, id, opData, clientId, previousValues })

/** A device queue; `rows` are the rows as they stand on the device now. */
function queue(
  crud: ReturnType<typeof entry>[],
  rows: Record<string, Record<string, unknown>> = {},
) {
  const complete = vi.fn(async () => {})
  return {
    complete,
    database: {
      getNextCrudTransaction: async () => ({ crud, complete }),
      getOptional: async (_sql: string, [id]: string[]) =>
        rows[id!] ? { id, ...rows[id!] } : null,
    } as never,
  }
}

function link() {
  const outcomes: UploadOutcome[] = []
  const outdated: boolean[] = []
  return {
    outcomes,
    outdated,
    link: {
      columnsOf: () => COLUMNS,
      recordOutcome: async (outcome: UploadOutcome) => {
        outcomes.push(outcome)
      },
      onOutdated: (value: boolean) => outdated.push(value),
    },
  }
}

const upload = async (
  client: never,
  crud: ReturnType<typeof entry>[],
  seen = link(),
  rows: Record<string, Record<string, unknown>> = {},
) => {
  const { complete, database } = queue(crud, rows)
  await createConnector(client, config, "user-1", seen.link).uploadData(
    database,
  )
  return { complete, outcome: seen.outcomes[0]!, seen }
}

describe("the backup connector", () => {
  it("maps synced tables to their server tables and refuses others", () => {
    expect(serverTable("synced_dutySettingItems")).toBe("dutySettingItems")
    expect(() => serverTable("meta")).toThrow("Not a synced table: meta")
  })

  it("sends an insert whole, every column, so it replaces and never merges (SC-B4-3)", async () => {
    const { client, calls } = fakeClient()
    await uploadEntries(
      client,
      [entry(UpdateType.PUT, { firstName: "Ada" }, undefined, "s-1")],
      "token-1",
      COLUMNS,
    )
    expect(calls[0]).toEqual({
      table: "students",
      op: "upsert",
      args: [
        [{ id: "s-1", firstName: "Ada", courseNote: null, updatedAt: null }],
      ],
    })
    expect(calls).toContainEqual({
      table: "students",
      op: "header",
      args: ["Authorization", "Bearer token-1"],
    })
  })

  it("deletes only a row nobody edited after this device saw it (SC-B4-2)", async () => {
    const { client, calls } = fakeClient()
    await uploadEntries(
      client,
      [
        entry(UpdateType.DELETE, undefined, undefined, "s-1", {
          updatedAt: "2026-09-19T09:00:00.000Z",
        }),
      ],
      "token-1",
      COLUMNS,
    )
    expect(calls).toContainEqual({
      table: "students",
      op: "lte",
      args: ["updatedAt", "2026-09-19T09:00:00.000Z"],
    })
  })

  it("groups consecutive inserts into one table, never one row twice (SC-B4-4)", () => {
    const course = entry(UpdateType.PUT, {}, "synced_courses")
    const students = Array.from({ length: BATCH_ROWS + 2 }, () =>
      entry(UpdateType.PUT, {}),
    )
    const again = { ...students[BATCH_ROWS + 1]!, clientId: ++clientId }
    const patch = entry(UpdateType.PATCH, {})
    const runs = uploadRuns([course, ...students, again, patch])
    expect(runs.map((run) => run.length)).toEqual([1, BATCH_ROWS, 2, 1, 1])
    expect(runs.flat()).toEqual([course, ...students, again, patch])
  })

  it("asks for the current session's token at every request", async () => {
    const { client } = fakeClient()
    const connector = createConnector(client, config, "user-1", link().link)
    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: config.powersyncUrl,
      token: "token-1",
      expiresAt: new Date(1_900_000_000 * 1000),
    })
  })
})

describe("what an upload does with each answer (B4)", () => {
  it("sends an edit as the whole row as it stands on the device", async () => {
    const { client, calls } = fakeClient()
    const patch = entry(UpdateType.PATCH, { courseNote: "nuova" })
    const { outcome } = await upload(client, [patch], link(), {
      [patch.id]: {
        firstName: "Eva",
        courseNote: "nuova",
        updatedAt: "2026-09-19T10:00:00.000Z",
      },
    })
    expect(calls[0]).toEqual({
      table: "students",
      op: "upsert",
      args: [
        [
          {
            id: patch.id,
            firstName: "Eva",
            courseNote: "nuova",
            updatedAt: "2026-09-19T10:00:00.000Z",
          },
        ],
      ],
    })
    expect(outcome.settledRows).toEqual([
      { tableName: "students", rowId: patch.id },
    ])
  })

  it("completes a written transaction; the row written whole settles its refusals", async () => {
    const { client } = fakeClient()
    const put = entry(UpdateType.PUT, { firstName: "Ada" })
    const { complete, outcome } = await upload(client, [put])
    expect(complete).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({
      refusals: [],
      settledRows: [{ tableName: "students", rowId: put.id }],
      superseded: 0,
    })
  })

  it("counts a change the server already held a later edit of (owner decision 12)", async () => {
    const { client } = fakeClient(
      () => ({ error: null, status: 200, changed: [] }),
      () => true,
    )
    const { outcome } = await upload(client, [
      entry(UpdateType.PUT, { firstName: "Ada" }),
      entry(UpdateType.PATCH, { firstName: "Eva" }),
      entry(UpdateType.DELETE, undefined, undefined, undefined, {
        updatedAt: "2026-09-19T09:00:00.000Z",
      }),
    ])
    expect(outcome.superseded).toBe(3)
    expect(outcome.refusals).toEqual([])
  })

  it("keeps an edit of a row the server does not have, instead of dropping it (SC-B4-5)", async () => {
    const { client } = fakeClient(
      () => ({ error: null, status: 200, changed: [] }),
      () => false,
    )
    const patch = entry(UpdateType.PATCH, { firstName: "Eva" })
    const { outcome } = await upload(client, [patch])
    expect(outcome.refusals).toEqual([
      expect.objectContaining({
        rowId: patch.id,
        op: UpdateType.PATCH,
        data: { firstName: "Eva" },
        reason: "missing",
      }),
    ])
  })

  it("lets a delete of a row already gone settle its refusals quietly", async () => {
    const { client } = fakeClient(
      () => ({ error: null, status: 200, changed: [] }),
      () => false,
    )
    const remove = entry(UpdateType.DELETE)
    const { outcome } = await upload(client, [remove])
    expect(outcome).toEqual({
      refusals: [],
      settledRows: [{ tableName: "students", rowId: remove.id }],
      superseded: 0,
    })
  })

  it("keeps the transaction queued on a transient failure, saying nothing about the row", async () => {
    const { client } = fakeClient(() => ({ error: { code: "" }, status: 503 }))
    const { complete, database } = queue([
      entry(UpdateType.PUT, { firstName: "Ada" }),
    ])
    const seen = link()
    await expect(
      createConnector(client, config, "user-1", seen.link).uploadData(database),
    ).rejects.toThrow("The backup did not answer; the change stays queued")
    expect(complete).not.toHaveBeenCalled()
    expect(seen.outcomes).toEqual([])
  })

  it("stops for an app older than the server's minimum and reports it", async () => {
    const { client } = fakeClient(() => ({
      error: { code: "CVOLD" },
      status: 400,
    }))
    const { complete, database } = queue([entry(UpdateType.PATCH, { a: 1 })])
    const seen = link()
    await expect(
      createConnector(client, config, "user-1", seen.link).uploadData(database),
    ).rejects.toThrow("newer app")
    expect(seen.outdated).toEqual([true])
    expect(complete).not.toHaveBeenCalled()
  })

  it("keeps a refused change with its data and lets the rest of the queue through", async () => {
    const refusedRow = "bad-row"
    const { client, calls } = fakeClient((_table, op, ids) =>
      op === "upsert" && ids.includes(refusedRow)
        ? { error: { code: "23502" }, status: 400 }
        : { error: null, status: 201 },
    )
    const good = entry(UpdateType.PUT, { firstName: "Ada" })
    const bad = entry(
      UpdateType.PUT,
      { firstName: "Eva" },
      undefined,
      refusedRow,
    )
    const after = entry(UpdateType.PATCH, { firstName: "Ida" })
    const { complete, outcome } = await upload(client, [good, bad, after])
    // The run of two failed whole, so each went alone; the PATCH went after.
    expect(calls.filter(({ op }) => op === "upsert")).toHaveLength(3)
    expect(calls.some(({ op }) => op === "update")).toBe(true)
    expect(outcome.refusals).toEqual([
      {
        id: `refusal:${bad.clientId}`,
        tableName: "students",
        rowId: refusedRow,
        op: UpdateType.PUT,
        data: { firstName: "Eva" },
        reason: "data",
        refusedAt: expect.any(String),
      },
    ])
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("reports a course id another account already holds", async () => {
    const { client } = fakeClient((table) =>
      table === "courses"
        ? { error: { code: "42501" }, status: 403 }
        : { error: null, status: 201 },
    )
    const { outcome } = await upload(client, [
      entry(UpdateType.PUT, {}, "synced_courses"),
    ])
    expect(outcome.refusals[0]?.reason).toBe("other-account")
  })
})

describe("a connector that outlives its account", () => {
  it("fetches no token and uploads nothing for another account", async () => {
    const { client, calls } = fakeClient()
    const connector = createConnector(client, config, "user-2", link().link)
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
