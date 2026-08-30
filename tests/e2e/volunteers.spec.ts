import path from "node:path"

import { expect, test } from "@playwright/test"

test("keeps ADV and IS persisted and separate from students", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Volontari" }).click()

  await expect(
    page.getByRole("heading", { name: "Nessun volontario" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Anna Bianchi")
  await page.getByRole("button", { name: "Salva volontario" }).click()

  await expect(
    page.getByRole("button", { name: "Anna Bianchi, ruolo ADV" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Luca Verdi")
  await page.getByText("IS", { exact: true }).click()
  await page.getByRole("button", { name: "Salva volontario" }).click()

  await page.getByRole("button", { name: "Anna Bianchi, ruolo ADV" }).click()
  await page.getByLabel("Nome completo").fill("Anna Neri")
  await page.getByText("IS", { exact: true }).click()
  await page.getByRole("button", { name: "Salva volontario" }).click()

  await expect(
    page.getByRole("button", { name: "Anna Neri, ruolo IS" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Luca Verdi, ruolo IS" }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Volontari" }).click()
  await expect(
    page.getByRole("button", { name: "Anna Neri, ruolo IS" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Luca Verdi, ruolo IS" }),
  ).toBeVisible()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve(".evidence/M5/volunteers-iphone13.png"),
    })
  }

  await page.getByRole("button", { name: "Indietro da Volontari" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await expect(
    page.getByRole("heading", { name: "Nessun allievo" }),
  ).toBeVisible()
})
