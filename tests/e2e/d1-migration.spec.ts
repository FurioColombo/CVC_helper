import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * D1 on the real PowerSync engine: courses written by 0.1.0, 0.2.0 and 0.3.0
 * gain record metadata and course ownership without losing a row, an id or a
 * value; a migration interrupted inside its transaction leaves nothing half
 * done; one stopped between steps completes on the next open; a second run
 * changes nothing; and the app itself opens an upgraded course and stamps
 * what it writes.
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

const LEDGER = [
  "migration:2026-10-d1-course-ownership",
  "migration:2026-10-d1-record-metadata",
]

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
      ledger: string[]
      reopenedIdentical: boolean
    }>(page, "runUpgrade", version)
    record(`upgrade-${version}`, result)

    expect(result.changedValues).toEqual([])
    expect(result.rowIssues).toEqual([])
    expect(result.ledger).toEqual(LEDGER)
    expect(result.reopenedIdentical).toBe(true)
    expect(result.counts).toMatchObject(fixtureRows(version))
  })
}

test("rolls an interrupted migration back whole and completes it on the next open, once", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    rolledBackUntouched: boolean
    ledgerAfterFailure: string[]
    ledgerAfterFirstStep: string[]
    appliedOnReopen: string[]
    rowIssues: unknown[]
    changedValues: string[]
    secondRunApplied: string[]
    secondRunIdentical: boolean
  }>(page, "runInterruption")
  record("interruption", result)

  expect(result.rolledBackUntouched).toBe(true)
  expect(result.ledgerAfterFailure).toEqual([])
  expect(result.ledgerAfterFirstStep).toEqual([LEDGER[0]])
  expect(result.appliedOnReopen).toEqual(["2026-10-d1-record-metadata"])
  expect(result.rowIssues).toEqual([])
  expect(result.changedValues).toEqual([])
  expect(result.secondRunApplied).toEqual([])
  expect(result.secondRunIdentical).toBe(true)
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
  // The app's first read runs the migrations; the course opens as before.
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
    const { COURSE_TABLES } = await load("/src/persistence/migrations.ts")
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
    // A few milliseconds, so the update's stamp cannot equal the migration's.
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
  // The deactivation moved updatedAt past the migration's stamp.
  expect(result.paolo.updatedAt > result.paolo.createdAt).toBe(true)
})

test("upgrades a 40-student course within five seconds", async ({ page }) => {
  await openBlankPage(page)
  const result = await harness<{
    durationMs: number
    rows: number
    rowIssues: unknown[]
  }>(page, "runLargeUpgrade")
  record("large-upgrade", result)
  test.info().annotations.push({
    type: "migration",
    description: `${result.rows} rows upgraded in ${result.durationMs} ms`,
  })
  expect(result.rowIssues).toEqual([])
  expect(result.rows).toBeGreaterThan(560)
  // A bound against a pathological migration, not a benchmark: 606 rows took
  // 640 ms on Chromium and 2.1 s on WebKit on the development PC (D1 evidence).
  expect(result.durationMs).toBeLessThan(5000)
})
