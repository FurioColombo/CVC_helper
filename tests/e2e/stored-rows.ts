import type { Page } from "@playwright/test"

type Tables = Record<string, Array<Record<string, unknown>>>

/**
 * D1's stored-row check (src/persistence/rowIntegrity.ts) over a snapshot of
 * the app's tables, run in the page so the app's own module answers. `meta`
 * holds the migration ledger, not records, and is left out.
 */
export async function storedRowIssues(page: Page, snapshot: Tables) {
  const tables = Object.fromEntries(
    Object.entries(snapshot).filter(([table]) => table !== "meta"),
  )
  return page.evaluate(async (stored) => {
    const modulePath = "/src/persistence/rowIntegrity.ts"
    const { validateStoredRows } = (await import(
      /* @vite-ignore */ modulePath
    )) as { validateStoredRows: (tables: Tables) => unknown[] }
    return validateStoredRows(stored)
  }, tables)
}
