import path from "node:path"

import { expect, test } from "@playwright/test"

test("manages boats and simultaneous faults through detail and global entry", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()

  await page.getByRole("button", { name: "Configura barche" }).click()
  await expect(page.getByLabel("Tipo")).toHaveValue("RS Quest")
  await page.getByLabel("Numeri barca").fill("2, 7")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /RS Quest 2, Nessuna avaria/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Aggiungi barca" }).click()
  await page.getByLabel("Tipo").selectOption("Laser Vago")
  await page.getByLabel("Numero barca").fill("9")
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /Laser Vago 9, Nessuna avaria/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: /RS Quest 2, Nessuna avaria/ }).click()
  await page.getByRole("button", { name: "Segnala", exact: true }).click()
  await page.getByLabel("Descrizione").fill("Scotta randa usurata")
  await page.getByRole("button", { name: "Salva avaria" }).click()
  await page.getByRole("button", { name: "Segnala", exact: true }).click()
  await page.getByLabel("Descrizione").fill("Timone duro")
  await page.getByRole("button", { name: "Salva avaria" }).click()

  const firstFault = page.getByRole("article").filter({
    hasText: "Scotta randa usurata",
  })
  await firstFault.getByRole("button", { name: "Comunicata" }).click()
  await firstFault.getByRole("button", { name: "Risolta" }).click()
  await expect(page.getByText("Storico risolte")).toBeVisible()
  await expect(page.getByText("Timone duro")).toBeVisible()

  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await expect(page.getByText("Non disponibile", { exact: true })).toBeVisible()
  await expect(page.getByText("Timone duro")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da RS Quest 2" }).click()
  const unavailableBoat = page.getByRole("button", {
    name: /RS Quest 2, Non disponibile, 1 non risolta/,
  })
  await expect(unavailableBoat).toBeVisible()
  await expect(unavailableBoat).toHaveClass(/bg-muted\/70/)

  await page
    .getByRole("button", { name: /Laser Vago 9, Nessuna avaria/ })
    .click()
  await page
    .getByRole("button", { name: "Elimina barca inserita per errore" })
    .click()
  await page.getByRole("button", { name: "Elimina", exact: true }).click()
  await expect(page.getByText("Laser Vago 9")).not.toBeVisible()

  await page.getByRole("button", { name: "Avarie", exact: true }).click()
  await page.getByRole("button", { name: "Segnala avaria" }).click()
  await page.getByLabel("Barca").selectOption({ label: "RS Quest 7" })
  await page.getByLabel("Descrizione").fill("Drizza usurata")
  await page.getByRole("button", { name: "Salva avaria" }).click()
  await expect(page.getByText("Drizza usurata")).toBeVisible()
  await expect(page.getByText("RS QUEST 7")).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Avarie", exact: true }).click()
  await expect(page.getByText("Drizza usurata")).toBeVisible()
  await expect(page.getByText("Timone duro")).toBeVisible()
  await expect(page.getByText("Scotta randa usurata")).toBeVisible()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve(".evidence/M6/boats-iphone13.png"),
    })
    await page.screenshot({
      path: path.resolve(".evidence/G2/boats-gate-iphone13.png"),
    })
  }

  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Barche", exact: true }).click()
  const persistedUnavailableBoat = page.getByRole("button", {
    name: /RS Quest 2, Non disponibile, 1 non risolta/,
  })
  await expect(persistedUnavailableBoat).toBeVisible()
  await expect(page.getByText("Laser Vago 9")).not.toBeVisible()
  await persistedUnavailableBoat.click()
  await page.getByRole("button", { name: "Rendi disponibile" }).click()
  await page.getByRole("button", { name: "Indietro da RS Quest 2" }).click()
  await expect(
    page.getByRole("button", {
      name: /RS Quest 2, Avaria aperta, 1 non risolta/,
    }),
  ).toBeVisible()
})
