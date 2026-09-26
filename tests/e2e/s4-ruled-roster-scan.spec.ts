import { readFile } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

const FIXTURES = path.resolve("tests/fixtures/ocr-synthetic")
const RULED_ROSTER = "roster-numbered-grid.png"
const RULED_ROSTER_WITH_STAFF = "roster-numbered-grid-staff.png"

interface SyntheticPerson {
  printedName: string
  firstName: string
  surname: string
  ambiguousCompound?: boolean
}

interface SyntheticVariant {
  file: string
  people: SyntheticPerson[]
  staff?: Array<{ printedName: string }>
}

async function variantFor(file: string) {
  const truth = JSON.parse(
    await readFile(path.join(FIXTURES, "truth.json"), "utf8"),
  ) as { variants: SyntheticVariant[] }
  return truth.variants.find((variant) => variant.file === file)!
}

async function scanRoster(page: Page, file: string) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(path.join(FIXTURES, file))
  await page.getByRole("button", { name: "Usa questa area" }).click()
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 60_000 })
}

async function surnameValues(page: Page) {
  const surnames = page.getByLabel(/^Cognome riga/)
  const values = await surnames.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  )
  return { surnames, values }
}

async function readyStudents(page: Page) {
  return Number(
    await page
      .getByRole("region", { name: "Stato revisione scansione" })
      .locator("strong")
      .nth(2)
      .textContent(),
  )
}

// Rows the operator must still settle (a compound name) are never ready.
function settledPeople(people: SyntheticPerson[]) {
  return people.filter((person) => !person.ambiguousCompound).length
}

// A wholly fictitious register printed as a ruled table with a row number
// before each name: the layout whose rule used to fuse with every surname.
test("reads a numbered, ruled roster without flagging its surnames", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { people } = await variantFor(RULED_ROSTER)
  await scanRoster(page, RULED_ROSTER)

  const { surnames, values } = await surnameValues(page)
  for (const person of people) {
    // Every person is read once, with the surname in the surname field.
    expect(
      values.filter((value) => value === person.surname),
      person.printedName,
    ).toHaveLength(1)
    const surname = surnames.nth(values.indexOf(person.surname))
    // The field's own caption carries "Da controllare" when it is uncertain.
    await expect(
      surname.locator("xpath=ancestor::label[1]"),
      `${person.surname} flag`,
    ).not.toContainText("Da controllare")
    const card = surname.locator("xpath=ancestor::article[1]")
    await expect(card.getByLabel(/^Nome riga/)).toHaveValue(person.firstName)
    if (person.ambiguousCompound) {
      // Offered, not settled: the operator still confirms the boundary.
      await expect(card.getByText(/Nome o cognome composto/)).toBeVisible()
    }
  }
  // No caption or stray fragment is counted as a ready student.
  expect(await readyStudents(page)).toBeLessThanOrEqual(settledPeople(people))
})

// The same register with its staff printed in a second ruled block below.
// Staff rows stay visible to be removed, but none may count as a ready
// student, and no student may take a staff member's values.
test("keeps staff printed below the register out of the ready students", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const { people, staff = [] } = await variantFor(RULED_ROSTER_WITH_STAFF)
  expect(staff.length).toBeGreaterThan(0)
  await scanRoster(page, RULED_ROSTER_WITH_STAFF)

  const { surnames, values } = await surnameValues(page)
  for (const person of people) {
    expect(
      values.filter((value) => value === person.surname),
      person.printedName,
    ).toHaveLength(1)
    const card = surnames
      .nth(values.indexOf(person.surname))
      .locator("xpath=ancestor::article[1]")
    // The age follows from the birth date read on the same row.
    await expect(
      card.getByLabel(/^Età riga/),
      `${person.surname} age`,
    ).toHaveAttribute("aria-invalid", "false")
  }

  let staffCards = 0
  for (const member of staff) {
    // Printed surname first, like the students.
    const surname = member.printedName.split(" ")[0]
    for (const [index, value] of values.entries()) {
      if (value !== surname) continue
      staffCards += 1
      // Refused by the table band: no age joins the name, so the row asks.
      await expect(
        surnames
          .nth(index)
          .locator("xpath=ancestor::article[1]")
          .getByLabel(/^Età riga/),
        `${surname} age`,
      ).toHaveAttribute("aria-invalid", "true")
    }
  }

  // The staff names are read and shown, so the checks above are not empty.
  expect(staffCards).toBeGreaterThan(0)
  expect(await readyStudents(page)).toBeLessThanOrEqual(settledPeople(people))
})
