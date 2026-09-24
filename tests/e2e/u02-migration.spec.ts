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

test("keeps legacy operational IDs through no-op and unrelated saves", async ({
  page,
}) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/u02MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runStableIdMigrationHarness: () => Promise<{
        before: Record<string, Array<Record<string, unknown>>>
        afterNoOp: Record<string, Array<Record<string, unknown>>>
        afterEditAndReopen: Record<string, Array<Record<string, unknown>>>
      }>
    }
    return harness.runStableIdMigrationHarness()
  })

  for (const table of [
    "dutyAssignments",
    "crews",
    "crewMembers",
    "landAssignments",
    "sessionBoats",
  ]) {
    const originalIds = result.before[table]!.map(({ id }) => id).sort()
    expect(result.afterNoOp[table]).toEqual(result.before[table])
    expect(result.afterNoOp[table]!.map(({ id }) => id).sort()).toEqual(
      originalIds,
    )
    for (const original of result.before[table]!) {
      expect(result.afterEditAndReopen[table]).toContainEqual(
        expect.objectContaining({ id: original.id }),
      )
    }
  }
  expect(result.afterEditAndReopen.dutyAssignments).toHaveLength(3)
  expect(result.afterEditAndReopen.crews).toContainEqual(
    expect.objectContaining({
      id: "crew-v010-sat-pm-2",
      destination: "unassigned",
    }),
  )
})

test("adds the nullable course-start age column to an existing local database", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("heading", { name: "Crea il corso" }).waitFor()
  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/u02MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runDeclaredAgeSchemaHarness: () => Promise<{
        legacyStudent: {
          dateOfBirth: string
          declaredAgeAtCourseStart: number | null
        }
        ageOnlyStudent: {
          dateOfBirth: string
          declaredAgeAtCourseStart: number | null
        }
      }>
    }
    return harness.runDeclaredAgeSchemaHarness()
  })

  expect(result.legacyStudent).toEqual({
    dateOfBirth: "2000-03-12",
    declaredAgeAtCourseStart: null,
  })
  expect(result.ageOnlyStudent).toEqual({
    dateOfBirth: "",
    declaredAgeAtCourseStart: 17,
  })
})
