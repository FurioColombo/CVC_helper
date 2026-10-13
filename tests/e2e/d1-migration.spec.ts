import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * D1 on the real PowerSync engine: courses written by 0.1.0, 0.2.0 and 0.3.0
 * gain record metadata and course ownership without losing a row, an id or a
 * value; the repairs settle what older versions left (a disordered updatedAt,
 * an orphan fault) and what an older app on the same database strips, while
 * the migration ledger survives it; an interruption inside the repairs or a
 * migration leaves nothing half done; a second run changes nothing; and the
 * app itself opens an upgraded course and stamps what it writes.
 */

const isAppRoot = (target: URL) => target.pathname === "/"

const fixtureRows = (version: string) => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        `../../src/test/fixtures/v${version}-course.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { tables: Record<string, unknown[]> }
  return Object.fromEntries(
    Object.entries(fixture.tables)
      .filter(([table]) => table !== "meta")
      .map(([table, rows]) => [table, rows.length]),
  )
}

/**
 * A blank page on the app's origin: the harness opens its own databases, and
 * the app opening cvc-helper.db beside them is not what these tests measure.
 */
async function openBlankPage(page: Page) {
  await page.route(isAppRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  )
  await page.goto("/")
  await page.unroute(isAppRoot)
}

/** Keeps a harness result: tracked evidence when CVC_EVIDENCE_REFRESH=D1. */
function record(name: string, result: unknown) {
  const info = test.info()
  const file = evidenceOutputPath(
    info,
    "D1",
    "migration",
    `${name}-${info.project.name}.json`,
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

async function harness<T>(page: Page, name: string, argument?: string) {
  return page.evaluate(
    async ([exportName, value]) => {
      const modulePath = "/src/test/d1MigrationHarness.ts"
      const module = (await import(/* @vite-ignore */ modulePath)) as Record<
        string,
        (input?: string) => Promise<unknown>
      >
      return module[exportName]!(value)
    },
    [name, argument] as const,
  ) as Promise<T>
}

for (const version of ["0.1.0", "0.2.0", "0.3.0"]) {
  test(`upgrades a ${version} course with every row, id and value intact and complete metadata`, async ({
    page,
  }) => {
    await openBlankPage(page)
    const result = await harness<{
      counts: Record<string, number>
      changedValues: string[]
      rowIssues: unknown[]
      reopenedIdentical: boolean
    }>(page, "runUpgrade", version)
    record(`upgrade-${version}`, result)

    expect(result.changedValues).toEqual([])
    expect(result.rowIssues).toEqual([])
    expect(result.reopenedIdentical).toBe(true)
    expect(result.counts).toMatchObject(fixtureRows(version))
  })
}

test("repairs a legacy fault updated with the clock set back and a fault whose boat is gone", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    rowIssues: unknown[]
    disorderedFault: Record<string, unknown>
    orphanFault: Record<string, unknown>
    courseId: string
  }>(page, "runLegacyRepairs")
  record("legacy-repairs", result)

  // The orphan keeps its dangling boat id, and the check still reports it.
  expect(result.rowIssues).toEqual([
    { table: "faults", id: "fault-v020-orphan", code: "missing-parent" },
  ])
  // updatedAt is lifted to the creation time, as 0.3.0 did on the next update.
  expect(result.disorderedFault).toMatchObject({
    createdAt: "2026-09-19T10:00:00.000Z",
    updatedAt: "2026-09-19T10:00:00.000Z",
    courseId: result.courseId,
  })
  expect(result.orphanFault).toMatchObject({
    courseId: result.courseId,
    createdAt: "2026-09-19T08:10:00.000Z",
  })
})

test("rolls interrupted repairs and an interrupted migration back whole and completes them on the next open, once", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    repairsRolledBack: boolean
    migrationRolledBack: boolean
    ledgerAfterFailure: string[]
    probesAfterFailure: string[]
    ledgerAfterReopen: string[]
    ledgerValuesAreTimes: boolean
    probesAfterReopen: string[]
    rowIssues: unknown[]
    changedValues: string[]
    secondRunApplied: string[]
    secondRunIdentical: boolean
  }>(page, "runInterruption")
  record("interruption", result)

  expect(result.repairsRolledBack).toBe(true)
  expect(result.migrationRolledBack).toBe(true)
  expect(result.ledgerAfterFailure).toEqual(["migration:test-first"])
  expect(result.probesAfterFailure).toEqual(["probe:first"])
  expect(result.ledgerAfterReopen).toEqual([
    "migration:test-first",
    "migration:test-second",
  ])
  expect(result.ledgerValuesAreTimes).toBe(true)
  expect(result.probesAfterReopen).toEqual(["probe:first", "probe:second"])
  expect(result.rowIssues).toEqual([])
  expect(result.changedValues).toEqual([])
  expect(result.secondRunApplied).toEqual([])
  expect(result.secondRunIdentical).toBe(true)
})

test("keeps the ledger and repairs the rows when a 0.3.0 app writes to the upgraded database", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    ledgerKept: boolean
    probesAfterReopen: string[]
    strippedByOlderApp: string[]
    rowIssues: unknown[]
    olderAppStudent: Record<string, unknown>
    untouchedStudentKeptCreatedAt: boolean
    olderAppEvaluation: Record<string, unknown>
    courseId: string
  }>(page, "runOlderAppAfterUpgrade")
  record("older-app", result)

  // What makes the repairs necessary: the older schema strips the new columns
  // from a row it updates (03 §3.1).
  expect(result.strippedByOlderApp).toEqual(["createdAt", "updatedAt"])
  expect(result.ledgerKept).toBe(true)
  expect(result.probesAfterReopen).toEqual(["probe:once"])
  expect(result.rowIssues).toEqual([])
  expect(result.olderAppStudent).toMatchObject({ active: 0 })
  expect(result.untouchedStudentKeptCreatedAt).toBe(true)
  expect(result.olderAppEvaluation).toMatchObject({
    courseId: result.courseId,
    value: "+",
  })
})

test("opens an upgraded 0.3.0 course in the app and stamps what the app writes", async ({
  page,
}) => {
  await page.route(isAppRoot, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body>Preparing 0.3.0 course<script type="module">
        import { seed } from "/src/test/d1MigrationHarness.ts";
        try {
          await seed("0.3.0", "cvc-helper.db");
          document.body.textContent = "0.3.0 course ready";
        } catch (error) {
          document.body.textContent = "0.3.0 seed failed: " + error;
        }
      </script></body></html>`,
    })
  })
  await page.goto("/")
  await expect(page.getByText("0.3.0 course ready")).toBeVisible()
  await page.unroute(isAppRoot)
  await page.goto("/")
  // The app's first read runs the repairs; the course opens as before.
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()

  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = await load("/src/persistence/db.ts")
    const { createFault, updateFaultState } = await load(
      "/src/persistence/boats.ts",
    )
    const { saveEvaluation } = await load("/src/persistence/evaluations.ts")
    const { setStudentActive } = await load("/src/persistence/students.ts")
    const { COURSE_TABLES } = await load("/src/persistence/schema.ts")
    const { validateStoredRows } = await load(
      "/src/persistence/rowIntegrity.ts",
    )

    const course = await db.get("SELECT id FROM courses WHERE active = 1")
    const fault = await createFault(
      "boat-v030-quest-7",
      "Stecca della randa rotta",
    )
    await updateFaultState(fault.id, "resolved")
    await saveEvaluation(course.id, "student-v030-marta", "sun-am", {
      value: "+",
      note: "Migliorata",
    })
    // A few milliseconds, so the update's stamp cannot equal the repairs'.
    await new Promise((resolve) => setTimeout(resolve, 20))
    await setStudentActive("student-v030-paolo", course.id, false)

    const tables: Record<string, unknown[]> = {}
    for (const table of COURSE_TABLES) {
      tables[table] = await db.getAll(`SELECT * FROM ${table}`)
    }
    const newFault = await db.get("SELECT * FROM faults WHERE id = ?", [
      fault.id,
    ])
    const newEvaluation = await db.get(
      "SELECT * FROM evaluations WHERE studentId = ? AND sessionId = ?",
      ["student-v030-marta", "sun-am"],
    )
    const paolo = await db.get("SELECT * FROM students WHERE id = ?", [
      "student-v030-paolo",
    ])
    return {
      courseId: course.id,
      issues: validateStoredRows(tables),
      newFault,
      newEvaluation,
      paolo,
    }
  })

  record("app-writes", {
    issues: result.issues,
    newFaultHasCourse: result.newFault.courseId === result.courseId,
    newEvaluationHasCourse: result.newEvaluation.courseId === result.courseId,
    deactivationMovedUpdatedAt: result.paolo.updatedAt > result.paolo.createdAt,
  })
  expect(result.issues).toEqual([])
  expect(result.newFault).toMatchObject({
    courseId: result.courseId,
    state: "resolved",
  })
  expect(result.newEvaluation).toMatchObject({ courseId: result.courseId })
  expect(result.newEvaluation.createdAt).toBe(result.newEvaluation.updatedAt)
  // The deactivation moved updatedAt past the repairs' stamp.
  expect(result.paolo.updatedAt > result.paolo.createdAt).toBe(true)
})

test("upgrades and reopens a 40-student course within five seconds each", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    durationMs: number
    createDatabaseMs: number
    initMs: number
    adapterInitMs: number
    sdkReadyAfterAdapterMs: number
    prepareAfterInitMs: number
    readTablesMs: number
    closeMs: number
    reopenMs: number
    reopenCreateDatabaseMs: number
    reopenInitMs: number
    reopenAdapterInitMs: number
    reopenSdkReadyAfterAdapterMs: number
    reopenPrepareAfterInitMs: number
    reopenReadTablesMs: number
    reopenCloseMs: number
    expectedRows: number
    expectedInjectedStudentRows: number
    injectedStudentRows: number
    reopenInjectedStudentRows: number
    expectedInjectedEvaluationRows: number
    injectedEvaluationRows: number
    reopenInjectedEvaluationRows: number
    rows: number
    reopenRows: number
    rowIssues: unknown[]
    reopenRowIssues: unknown[]
    reopenedIdentical: boolean
  }>(page, "runLargeUpgrade")
  record("large-upgrade", result)
  test.info().annotations.push({
    type: "migration",
    description: `${result.rows}/${result.reopenRows} rows (expected ${result.expectedRows}); upgrade ${result.durationMs} ms (create ${result.createDatabaseMs}, adapter init ${result.adapterInitMs}, SDK ready after adapter ${result.sdkReadyAfterAdapterMs}, total init ${result.initMs}, prepare ${result.prepareAfterInitMs}); reopen ${result.reopenMs} ms (create ${result.reopenCreateDatabaseMs}, adapter init ${result.reopenAdapterInitMs}, SDK ready after adapter ${result.reopenSdkReadyAfterAdapterMs}, total init ${result.reopenInitMs}, prepare ${result.reopenPrepareAfterInitMs}); injected students ${result.injectedStudentRows}/${result.reopenInjectedStudentRows} of ${result.expectedInjectedStudentRows}, evaluations ${result.injectedEvaluationRows}/${result.reopenInjectedEvaluationRows} of ${result.expectedInjectedEvaluationRows}; read/close outside bound ${result.readTablesMs}/${result.closeMs} ms and ${result.reopenReadTablesMs}/${result.reopenCloseMs} ms`,
  })
  expect(result.rowIssues).toEqual([])
  expect(result.reopenRows).toBe(result.rows)
  expect(result.reopenRowIssues).toEqual([])
  expect(result.reopenedIdentical).toBe(true)
  expect(result.expectedRows).toBe(609)
  expect(result.rows).toBe(result.expectedRows)
  expect(result.reopenRows).toBe(result.expectedRows)
  expect(result.expectedInjectedStudentRows).toBe(40)
  expect(result.injectedStudentRows).toBe(result.expectedInjectedStudentRows)
  expect(result.reopenInjectedStudentRows).toBe(
    result.expectedInjectedStudentRows,
  )
  expect(result.expectedInjectedEvaluationRows).toBe(560)
  expect(result.injectedEvaluationRows).toBe(
    result.expectedInjectedEvaluationRows,
  )
  expect(result.reopenInjectedEvaluationRows).toBe(
    result.expectedInjectedEvaluationRows,
  )
  // The same five-second bound covers construction, SDK init and preparation;
  // stage timings above help diagnose a slow open without weakening it.
  expect(result.durationMs).toBeLessThan(5000)
  expect(result.reopenMs).toBeLessThan(5000)
})
