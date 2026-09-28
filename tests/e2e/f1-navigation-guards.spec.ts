import { expect, test, type Page } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
}

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page
    .getByRole("button", { name: "Aggiungi allievo", exact: true })
    .click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("16")
  await page.getByRole("button", { name: "Salva allievo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(`^${firstName},`) }),
  ).toBeVisible()
}

test("phone Back keeps an unsaveable edit open and says why, then saves and leaves", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await createCourse(page)
  await addStudent(page, "Marta", "Veldor")
  await page.getByRole("button", { name: /^Marta,/ }).click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel("Cognome", { exact: true }).fill("")

  await page.goBack()
  await expect(
    page.getByRole("heading", { name: "Modifica allievo" }),
  ).toBeVisible()
  await expect(page.getByRole("alert")).toContainText(
    "Per uscire completa cognome.",
  )

  await page.getByLabel("Cognome", { exact: true }).fill("Brumera")
  await page.goBack()
  await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible()
  // The profile shows what the form saved, not the state before the edit.
  await expect(page.getByText("Brumera").first()).toBeVisible()
  await page.reload()
  await expect(page.getByText("Brumera").first()).toBeVisible()
})

test("phone Back holds Valutazioni while a note is open", async ({ page }) => {
  test.setTimeout(90_000)
  await createCourse(page)
  await addStudent(page, "Marta", "Veldor")
  const primaryNavigation = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNavigation
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Valutazioni", exact: true }).click()
  await page
    .getByRole("button", { name: /Aggiungi nota valutazione di Marta/ })
    .click()
  await page
    .getByRole("textbox", { name: /Nota valutazione di Marta/ })
    .fill("Buona conduzione")

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Valutazioni" })).toBeVisible()
  await expect(
    page.getByText("Salva o annulla la nota prima di uscire."),
  ).toBeVisible()
  await primaryNavigation
    .getByRole("button", { name: "Avarie", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Valutazioni" })).toBeVisible()

  await page.getByRole("button", { name: "Salva nota", exact: true }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Marta"),
  ).toHaveText("Salvato")
  await page.goBack()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

test("phone Back walks back through the boat screens before leaving Barche", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await createCourse(page)
  await page.getByRole("button", { name: "Barche", exact: true }).click()
  await page
    .getByRole("button", { name: "Configura barche", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Configura barche" }),
  ).toBeVisible()

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Barche" })).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

test("Settings erases the course only after confirmation and starts a new one", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await createCourse(page)
  await addStudent(page, "Marta", "Veldor")
  const primaryNavigation = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNavigation
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  const eraseAll = page.getByRole("button", { name: "Elimina tutto" })
  await expect(eraseAll).toBeDisabled()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  await eraseAll.click()

  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()

  // A new course starts empty: nothing of the erased one remains.
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  const home = page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ })
  await expect(home).toBeVisible()
  // The erased course's screens are still in this tab's history; the phone's
  // Back must not reopen them for the new course.
  await page.goBack()
  await page.goBack()
  await expect(home).toBeVisible()
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toHaveCount(
    0,
  )
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Marta,/ })).toHaveCount(0)
})
