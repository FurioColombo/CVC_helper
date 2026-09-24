import { expect, test } from "@playwright/test"

test("Back follows nested screens, closes a dialog, and keeps local data", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Torna alla Home", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  const primaryNavigation = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNavigation
    .getByRole("button", { name: "Avarie", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Avarie" })).toBeVisible()
  await page
    .getByRole("button", { name: "Configura barche", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Barche" })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Avarie" })).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await page
    .getByRole("button", { name: "Aggiungi allievo", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Nuovo allievo" }),
  ).toBeVisible()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(page.getByLabel("Nome", { exact: true })).toHaveCount(0)
  await page
    .getByRole("button", { name: "Aggiungi allievo", exact: true })
    .click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page.getByRole("button", { name: "Salva allievo", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Mario,/ })).toBeVisible()

  await page.getByRole("button", { name: "Menu allievi", exact: true }).click()
  await page
    .getByRole("button", { name: "Conoscenza allievi", exact: true })
    .click()
  await page.getByRole("button", { name: "Nota di Mario", exact: true }).click()
  const note = page.getByLabel("Nota iniziale di Mario")
  await expect(page.getByRole("dialog")).toBeVisible()
  await note.fill("Nota persistente dopo Back")
  const saveStatus = page.getByLabel("Stato salvataggio Mario")
  await expect(saveStatus).toHaveText("Salvato")

  await page.goBack()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    page.getByRole("region", { name: "Conoscenza allievi" }),
  ).toBeVisible()
  await expect(page.getByLabel("Stato salvataggio Mario")).toHaveText("Salvato")

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Mario,/ })).toBeVisible()

  await page.getByRole("button", { name: "Menu allievi", exact: true }).click()
  await page
    .getByRole("button", { name: "Conoscenza allievi", exact: true })
    .click()
  await page.getByRole("button", { name: "Nota di Mario", exact: true }).click()
  await expect(page.getByLabel("Nota iniziale di Mario")).toHaveValue(
    "Nota persistente dopo Back",
  )
  await page.getByRole("button", { name: "Fine", exact: true }).click()
  await primaryNavigation
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

test("visible Back from Students returns home after reload", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page
    .getByRole("button", { name: "Aggiungi allievo", exact: true })
    .click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page.getByRole("button", { name: "Salva allievo", exact: true }).click()
  await page.getByRole("button", { name: /^Mario,/ }).click()
  await page
    .getByRole("button", { name: "Indietro da Profilo", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  const beforeBack = await page.evaluate(() => ({
    state: window.history.state,
    length: window.history.length,
  }))
  expect(beforeBack.state.__cvcHelperShell.view).toBe("students")

  await page
    .getByRole("button", { name: "Indietro da Allievi", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  const afterBack = await page.evaluate(() => ({
    state: window.history.state,
    length: window.history.length,
  }))
  expect(afterBack.state.__cvcHelperShell).toEqual({ view: "home", depth: 0 })
  expect(afterBack.length).toBe(beforeBack.length)
})
