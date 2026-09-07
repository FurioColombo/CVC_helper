import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

const evidenceDirectory = path.resolve(".evidence/U02")

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
}

async function addStudent(
  page: Page,
  firstName: string,
  surname: string,
  dateOfBirth: string,
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel("Data di nascita", { exact: true }).fill(dateOfBirth)
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("keeps the compact list and complete profile usable at the stress viewport", async ({
  page,
}, testInfo) => {
  mkdirSync(evidenceDirectory, { recursive: true })
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await addStudent(page, "Mario", "Rossi", "2010-01-01")
  await addStudent(page, "Mario", "Bianchi", "2000-01-01")
  await addStudent(page, "Alessandra", "Della Rovere Lunghissima", "1999-04-03")
  await addStudent(page, "Beatrice", "Colombo", "2001-08-05")

  const list = page.getByRole("region", { name: "Elenco allievi" })
  await expect(list).toBeVisible()
  expect(
    await list.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    ),
  ).toMatch(/\S+\s+\S+/)
  await expect(page.getByText("Mario B.", { exact: true })).toBeVisible()
  await expect(page.getByText("Mario R.", { exact: true })).toBeVisible()

  const add = page.getByRole("button", { name: "Aggiungi allievo" })
  await add.focus()
  await expect(add).toBeFocused()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const clearance = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(
      'button[aria-label="Aggiungi allievo"]',
    )
    const lastCard = document.querySelector<HTMLElement>(
      '[aria-label="Elenco allievi"] button:last-child',
    )
    if (!button || !lastCard) return -1
    return (
      button.getBoundingClientRect().top -
      lastCard.getBoundingClientRect().bottom
    )
  })
  expect(clearance).toBeGreaterThanOrEqual(8)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: path.join(
      evidenceDirectory,
      `p03-stress-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })

  await page.getByRole("button", { name: /Mario R\., 16 anni/ }).click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page
    .getByRole("group", { name: "Taglia" })
    .getByText("L", { exact: true })
    .click()
  await page.getByLabel("Nota iniziale").fill("Esperienza Optimist")
  await page.getByLabel("Nota del corso").fill("Migliora nelle virate")
  await expect(page.getByText("Salvato", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByText("Esperienza Optimist")).toBeVisible()
  await expect(page.getByText("Migliora nelle virate")).toBeVisible()

  await page.evaluate(async () => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(/* @vite-ignore */ modulePath)) as {
      db: {
        get: <T>(sql: string, parameters: unknown[]) => Promise<T>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
      }
    }
    const student = await db.get<{ id: string }>(
      "SELECT id FROM students WHERE firstName = ? AND surname = ?",
      ["Mario", "Rossi"],
    )
    await db.execute(
      "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), student.id, "sat-pm", "+", "Buona partenza"],
    )
    await db.execute(
      "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), student.id, "sun-am", "++", null],
    )
  })

  await page.reload()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: /Mario R\., 16 anni/ }).click()
  await expect(page.getByText("Esperienza Optimist")).toBeVisible()
  await expect(page.getByText("Migliora nelle virate")).toBeVisible()
  await expect(page.getByText("L", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("table", { name: "Valutazioni settimanali di Mario R." }),
  ).toBeVisible()
  await expect(page.getByLabel("Sabato PM: +")).toBeVisible()
  await expect(page.getByLabel("Domenica AM: ++")).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: path.join(
      evidenceDirectory,
      `p04-profile-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })
})
