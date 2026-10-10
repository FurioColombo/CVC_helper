import type { Page } from "@playwright/test"

/**
 * D1's stored-row check (src/persistence/rowIntegrity.ts) over the app's
 * course tables, read and checked in the page so the app's own modules answer,
 * and D2's: the duty-setting rows match the lists stored beside them. Call it
 * before the page closes: the next open's repairs fill what a write path left
 * out, so a check after a reopen cannot see it.
 */
export async function storedRowIssues(page: Page) {
  return page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = await load("/src/persistence/db.ts")
    const { COURSE_TABLES } = await load("/src/persistence/schema.ts")
    const { validateStoredRows } = await load(
      "/src/persistence/rowIntegrity.ts",
    )
    const { dutySettingItemsNeedRepair } = await load(
      "/src/persistence/repairs.ts",
    )
    const tables: Record<string, unknown[]> = {}
    for (const table of COURSE_TABLES as string[]) {
      tables[table] = await db.getAll(`SELECT * FROM ${table}`)
    }
    const issues = validateStoredRows(tables) as unknown[]
    if (await dutySettingItemsNeedRepair(db)) {
      issues.push({ table: "dutySettingItems", code: "differs-from-lists" })
    }
    return issues
  })
}
