import { expect, test } from "@playwright/test"

test("upgrades and reopens the complete 0.1 database without data loss", async ({
  page,
}) => {
  await page.goto("/")

  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/u02MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runU02MigrationHarness: () => Promise<{
        fixture: Record<string, Array<Record<string, unknown>>>
        afterUpgrade: Record<string, Array<Record<string, unknown>>>
        afterReopen: Record<string, Array<Record<string, unknown>>>
        defaultCourseNote: string | null
        reloadedCourseNote: string | null
      }>
    }
    return harness.runU02MigrationHarness()
  })

  expect(result.defaultCourseNote).toBeNull()
  expect(result.reloadedCourseNote).toBe("Nuova nota 0.2")
  expect(Object.keys(result.afterUpgrade).sort()).toEqual(
    Object.keys(result.fixture).sort(),
  )
  expect(Object.keys(result.afterReopen).sort()).toEqual(
    Object.keys(result.fixture).sort(),
  )

  for (const [tableName, fixtureRows] of Object.entries(result.fixture)) {
    const upgradedRows = result.afterUpgrade[tableName]
    const reopenedRows = result.afterReopen[tableName]
    expect(upgradedRows, `${tableName} count`).toHaveLength(fixtureRows.length)
    expect(reopenedRows, `${tableName} reopen count`).toHaveLength(
      fixtureRows.length,
    )
    for (const fixtureRow of fixtureRows) {
      const upgradedRow = upgradedRows?.find(({ id }) => id === fixtureRow.id)
      const reopenedRow = reopenedRows?.find(({ id }) => id === fixtureRow.id)
      expect(upgradedRow, `${tableName}:${String(fixtureRow.id)}`).toBeDefined()
      expect(upgradedRow).toMatchObject(fixtureRow)
      expect(
        reopenedRow,
        `${tableName}:${String(fixtureRow.id)} after reopen`,
      ).toBeDefined()
      expect(reopenedRow).toMatchObject(fixtureRow)
    }
  }

  expect(
    (result.afterReopen.students ?? []).find(
      ({ id }) => id === "student-v010-mario",
    )?.courseNote,
  ).toBe("Nuova nota 0.2")
})
