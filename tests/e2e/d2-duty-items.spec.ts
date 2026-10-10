import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * D2 on the real PowerSync engine: every fixture's duty-settings lists open as
 * rows, item by item, in order, none lost or doubled; long lists out of day
 * order keep their order and store a repeat once; and a 0.3.0 app that opens
 * the upgraded database, dropping the rows' table, and writes the lists has
 * its changes rebuilt as rows on the next open.
 */

const isAppRoot = (target: URL) => target.pathname === "/"

/** A blank page on the app's origin: the harness opens its own databases. */
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

/** Keeps a harness result: tracked evidence when CVC_EVIDENCE_REFRESH=D2. */
function record(name: string, result: unknown) {
  const info = test.info()
  const file = evidenceOutputPath(
    info,
    "D2",
    "migration",
    `${name}-${info.project.name}.json`,
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

async function harness<T>(page: Page, name: string, argument?: string) {
  return page.evaluate(
    async ([exportName, value]) => {
      const modulePath = "/src/test/d2DutyItemsHarness.ts"
      const module = (await import(/* @vite-ignore */ modulePath)) as Record<
        string,
        (input?: string) => Promise<unknown>
      >
      return module[exportName]!(value)
    },
    [name, argument] as const,
  ) as Promise<T>
}

interface ListsResult {
  courses: number
  items: number
  differences: string[]
  listsFromRows: Record<string, Record<string, string[]>>
  rowIssues: unknown[]
  itemsBehind: boolean
}

// The fixtures' lists, as items: 0.1.0 has a stay-over student and a
// completed day and no extra days; 0.2.0 and 0.3.0 also one extra day.
for (const [version, items] of [
  ["0.1.0", 2],
  ["0.2.0", 3],
  ["0.3.0", 3],
] as const) {
  test(`opens the ${version} duty lists as rows, item by item, none lost or doubled`, async ({
    page,
  }) => {
    await openBlankPage(page)
    const result = await harness<ListsResult & { reopenedIdentical: boolean }>(
      page,
      "runListsUpgrade",
      version,
    )
    record(`lists-${version}`, result)

    expect(result.courses).toBe(1)
    expect(result.items).toBe(items)
    expect(result.differences).toEqual([])
    expect(result.rowIssues).toEqual([])
    expect(result.itemsBehind).toBe(false)
    expect(result.reopenedIdentical).toBe(true)
  })
}

test("keeps the order of long lists and stores a repeated item once", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<ListsResult>(page, "runRichListsUpgrade")
  record("rich-lists", result)

  expect(result.differences).toEqual([])
  expect(result.rowIssues).toEqual([])
  expect(result.listsFromRows["course-v030-d2"]).toEqual({
    fewerDayIds: ["tuesday", "saturday"],
    extraDayIds: ["friday", "monday", "wednesday"],
    stayOverStudentIds: ["student-v030-sara", "student-v030-davide"],
    completedDayIds: ["sunday", "saturday"],
    acknowledgedWarningKeys: ["sex-balance:monday", "minor-balance:2,0"],
  })
})

test("rebuilds the rows after a 0.3.0 app drops their table and writes the lists", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<
    ListsResult & {
      itemsBefore: number
      tableDroppedByOlderApp: boolean
      completedWrittenByOlderApp: string[]
      course: string
    }
  >(page, "runOlderAppDropsItems")
  record("older-app", result)

  expect(result.itemsBefore).toBe(3)
  // Why the lists are still written beside the rows (03 §3.1).
  expect(result.tableDroppedByOlderApp).toBe(true)
  expect(result.completedWrittenByOlderApp).toEqual(["saturday", "sunday"])
  expect(result.differences).toEqual([])
  expect(result.rowIssues).toEqual([])
  expect(result.listsFromRows[result.course]).toMatchObject({
    completedDayIds: ["saturday", "sunday"],
    stayOverStudentIds: [],
    extraDayIds: ["monday"],
  })
})

test("shows a stale 0.3.0 tab's list changes at once and keeps its stay-over student from deletion", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    rowsBeforeOlderSave: number
    stayOverStudentIds: string[]
    completedDayIds: string[]
    paoloDeletable: boolean
    paoloReferences: string[]
  }>(page, "runStaleOlderTab")
  record("stale-older-tab", result)

  expect(result.rowsBeforeOlderSave).toBe(3)
  expect(result.stayOverStudentIds).toEqual([
    "student-v030-davide",
    "student-v030-paolo",
  ])
  expect(result.completedDayIds).toEqual(["saturday", "sunday"])
  expect(result.paoloDeletable).toBe(false)
  expect(result.paoloReferences).toContain("stay-over")
})

test("erases the course after a 0.3.0 tab dropped the rows' table under the open app", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<{
    rowsBefore: number
    tableDroppedByOlderApp: boolean
    erased: boolean
    remaining: Record<string, number>
  }>(page, "runEraseAfterOlderSchema")
  record("erase-after-older-schema", result)

  expect(result.rowsBefore).toBe(3)
  expect(result.tableDroppedByOlderApp).toBe(true)
  expect(result.erased).toBe(true)
  expect(result.remaining).toEqual({
    courses: 0,
    students: 0,
    dutySettings: 0,
    evaluations: 0,
  })
})
