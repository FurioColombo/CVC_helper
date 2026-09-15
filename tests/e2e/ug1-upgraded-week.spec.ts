import { mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { expect, test } from "@playwright/test"

import { SESSION_SEQUENCE } from "../../src/domain/config"

const fixture = JSON.parse(
  readFileSync(
    new URL("../../src/test/fixtures/v0.1.0-course.json", import.meta.url),
    "utf8",
  ),
) as { tables: Record<string, Array<Record<string, unknown>>> }

test("runs an upgraded 0.1.0 course through the visible week and keeps its history", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full migrated week is sufficient",
  )
  test.setTimeout(600_000)
  context.setDefaultTimeout(30_000)

  await page.route("http://127.0.0.1:4173/", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body>Preparing legacy course<script type="module">
        import { seedLegacyFixture } from "/src/test/u02MigrationHarness.ts";
        try {
          await seedLegacyFixture("cvc-helper.db");
          document.body.textContent = "Legacy course ready";
        } catch (error) {
          document.body.textContent = "Legacy seed failed: " + error;
        }
      </script></body></html>`,
    })
  })
  await page.goto("/")
  await expect(page.getByText("Legacy course ready")).toBeVisible()
  await page.unroute("http://127.0.0.1:4173/")
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "D2 - 35 | 2026" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi" }).click()
  await expect(page.getByRole("button", { name: /^Mario,/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Giu,/ })).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Luca,.*Non disponibile/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await page.getByRole("button", { name: "Volontari" }).click()
  await expect(
    page.getByRole("button", { name: "Anna ADV, ruolo ADV" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Clara CT")
  await page
    .getByRole("group", { name: "Ruolo" })
    .getByText("CT", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await expect(
    page.getByRole("button", { name: "Clara CT, ruolo CT" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Volontari" }).click()

  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("button", { name: /^Sabato, 1 assegnati/ }),
  ).toContainText("Mario")
  await page.getByRole("button", { name: /^Mercoledì, 0 assegnati/ }).click()
  await page.getByRole("button", { name: "Giu", exact: true }).click()
  await page
    .getByRole("button", { name: "Indietro da Comandata mercoledì" })
    .click()
  await expect(
    page.getByRole("button", { name: /^Mercoledì, 1 assegnati/ }),
  ).toContainText("Giu")
  await page.getByRole("button", { name: "Indietro da Comandate" }).click()

  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  for (const session of SESSION_SEQUENCE) {
    await page
      .getByRole("combobox", { name: "Sessione" })
      .selectOption(session.id)
    if (session.id === "sat-pm") {
      await expect(page.getByText("Allievi sistemati 2/2")).toBeVisible()
      continue
    }
    await page.getByRole("spinbutton").fill("1")
    await page.getByRole("button", { name: "Crea equipaggi" }).click()
    const pool = page.getByRole("region", { name: "Allievi disponibili" })
    await pool.getByRole("button", { name: "Mario", exact: true }).click()
    await page
      .getByRole("button", { name: "Sposta Mario in equipaggio 1" })
      .click()
    if (session.id !== "sun-am") {
      await pool.getByRole("button", { name: "Giu", exact: true }).click()
      await page
        .getByRole("button", { name: "Sposta Giu in equipaggio 1" })
        .click()
    } else {
      await expect(
        page.getByRole("button", { name: "Giu, A terra" }),
      ).toBeVisible()
    }
    await expect(page.getByText("Allievi sistemati 2/2")).toBeVisible()
  }

  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  for (const session of SESSION_SEQUENCE) {
    await page.getByLabel("Sessione valutazioni").selectOption(session.id)
    if (session.id === "sat-pm") {
      await expect(
        page.getByRole("button", {
          name: "Valutazione di Mario: +",
          exact: true,
        }),
      ).toBeVisible()
      continue
    }
    await page
      .getByRole("button", { name: "Valutazione di Mario: +", exact: true })
      .click()
    await expect(
      page.getByLabel("Stato salvataggio valutazione di Mario"),
    ).toHaveText("Salvato")
  }

  await page.close()
  const reopened = await context.newPage()
  await reopened.goto("/")
  await expect(
    reopened.getByRole("heading", { name: "D2 - 35 | 2026" }),
  ).toBeVisible()
  await reopened.getByRole("button", { name: "Valutazioni" }).click()
  await reopened
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await reopened
    .getByRole("button", { name: "Mario, Sabato PM: +, nota presente" })
    .click()
  await expect(reopened.getByText("Manovre ordinate")).toBeVisible()

  const originalRows = await reopened.evaluate(async () => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(/* @vite-ignore */ modulePath)) as {
      db: { getAll: (query: string) => Promise<Array<Record<string, unknown>>> }
    }
    const tables = [
      "courses",
      "students",
      "volunteers",
      "boats",
      "faults",
      "dutyAssignments",
      "dutySettings",
      "crews",
      "crewMembers",
      "landAssignments",
      "sessionBoats",
      "evaluations",
      "meta",
    ]
    const snapshot: Record<string, Array<Record<string, unknown>>> = {}
    for (const table of tables)
      snapshot[table] = await db.getAll(`SELECT * FROM ${table}`)
    return snapshot
  })
  for (const [table, rows] of Object.entries(fixture.tables)) {
    for (const oldRow of rows) {
      const retained = originalRows[table]?.find(({ id }) => id === oldRow.id)
      expect(
        retained,
        `${table}:${oldRow.id} survives week and reopen`,
      ).toBeDefined()
      if (table !== "dutySettings") expect(retained).toMatchObject(oldRow)
    }
  }
  expect(originalRows.volunteers).toHaveLength(
    (fixture.tables.volunteers?.length ?? 0) + 1,
  )
  expect(originalRows.evaluations?.length).toBeGreaterThan(
    fixture.tables.evaluations?.length ?? 0,
  )
  const evidenceDirectory = resolve(".evidence/UG1")
  mkdirSync(evidenceDirectory, { recursive: true })
  await reopened.screenshot({
    path: resolve(evidenceDirectory, "upgraded-week-overview.png"),
  })
})
