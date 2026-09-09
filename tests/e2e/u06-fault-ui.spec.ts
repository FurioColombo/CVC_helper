import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, type Page, test, type TestInfo } from "@playwright/test"

const LONG_FAULT =
  "Scotta randa sfibrata vicino al bozzello di poppa; controllare il grillo prima dell’uscita e sostituire se necessario."
const SECOND_FAULT = "Timone duro durante la manovra di uscita"
const OTHER_BOAT_FAULT = "Drizza usurata da verificare prima dell’imbarco"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function configureBoats(page: Page) {
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await expect(page.getByLabel("Tipo")).toHaveValue("RS Quest")
  await page.getByLabel("Numeri barca").fill("2, 7")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /RS Quest 2, Disponibile/ }),
  ).toBeVisible()
}

async function openFaults(page: Page) {
  await page.getByRole("button", { name: "Avarie", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Avarie" })).toBeVisible()
}

function faultCard(page: Page, description: string) {
  return page.getByRole("article").filter({ hasText: description })
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}

async function addFault(page: Page, description: string, boatLabel?: string) {
  await page.getByRole("button", { name: "Segnala avaria" }).click()
  const form = page.locator("form")
  await expect(form.getByLabel("Descrizione")).toBeVisible()
  if (boatLabel) {
    await form.getByLabel("Barca").selectOption({ label: boatLabel })
  }
  await form.getByLabel("Descrizione").fill(description)
  await form.getByRole("button", { name: "Salva avaria" }).click()
  await expect(faultCard(page, description)).toBeVisible()
}

async function capturePixelScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  if (testInfo.project.name !== "pixel-7-chrome") return
  const evidenceDirectory = path.resolve(".evidence/U06")
  await mkdir(evidenceDirectory, { recursive: true })
  await page.screenshot({
    fullPage: true,
    path: path.join(evidenceDirectory, `${name}-${testInfo.project.name}.png`),
  })
}

test("keeps long and simultaneous faults usable across states, reload and speech recovery", async ({
  page,
}, testInfo) => {
  // U03 owns the successful deterministic audio fixture. U06 exercises the
  // real P09 form and a realistic permission failure so typed text survives.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Microphone denied", "NotAllowedError")
        },
      },
    })
  })

  await createCourse(page)
  await configureBoats(page)
  await openFaults(page)

  await expect(
    page.getByRole("heading", { name: "Nessuna avaria" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Segnala avaria" }).click()
  const form = page.locator("form")
  const description = form.getByLabel("Descrizione")
  const dictation = form.getByRole("button", { name: "Detta avaria" })
  await expect(description).toBeVisible()
  await expect(dictation).toBeVisible()
  await expect(dictation).toBeEnabled()

  await description.fill(LONG_FAULT)
  await dictation.click()
  const speechAlert = page.getByRole("alert")
  await expect(speechAlert).toContainText(/microfono|dettatura/i)
  await expect(speechAlert).toContainText(/testo/i)
  await expect(description).toHaveValue(LONG_FAULT)
  // The retry control keeps the shared panel recoverable after denial.
  const speechRetry = speechAlert.getByRole("button", {
    name: "Riprovare dettatura avaria",
  })
  await expect(speechRetry).toBeVisible()
  await speechRetry.click()
  await expect(speechAlert).toContainText(/microfono|dettatura/i)
  await expect(description).toHaveValue(LONG_FAULT)

  await form.getByRole("button", { name: "Salva avaria" }).click()
  const longCard = faultCard(page, LONG_FAULT)
  await expect(longCard).toBeVisible()
  await expect(longCard.getByLabel("RS Quest 2")).toBeVisible()
  await expect(longCard.getByText(LONG_FAULT, { exact: true })).toBeVisible()
  const longPreview = longCard.getByRole("button", {
    name: `Apri descrizione: ${LONG_FAULT}`,
  })
  await expect(longPreview).toHaveAttribute("aria-expanded", "false")
  await longPreview.click()
  await expect(
    longCard.getByRole("button", {
      name: `Riduci descrizione: ${LONG_FAULT}`,
    }),
  ).toHaveAttribute("aria-expanded", "true")

  await addFault(page, SECOND_FAULT, "RS Quest 2")
  await addFault(page, OTHER_BOAT_FAULT, "RS Quest 7")
  await expect(
    page.getByRole("heading", { name: "Da gestire · 3" }),
  ).toBeVisible()
  await expect(page.getByRole("article")).toHaveCount(3)

  for (const cardText of [LONG_FAULT, SECOND_FAULT, OTHER_BOAT_FAULT]) {
    const card = faultCard(page, cardText)
    const states = card.getByRole("group", {
      name: `Stato avaria ${cardText}`,
    })
    await expect(states.getByRole("button")).toHaveCount(3)
    await expect(states.getByRole("button", { name: "Aperta" })).toBeVisible()
    await expect(
      states.getByRole("button", { name: "Comunicata" }),
    ).toBeVisible()
    await expect(states.getByRole("button", { name: "Risolta" })).toBeVisible()
  }

  // The first card moves to history while the other two remain unresolved.
  await longCard.getByRole("button", { name: "Comunicata" }).click()
  await expect(
    faultCard(page, LONG_FAULT).getByRole("button", { name: "Comunicata" }),
  ).toHaveAttribute("aria-pressed", "true")
  await faultCard(page, LONG_FAULT)
    .getByRole("button", { name: "Risolta" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Storico risolte" }),
  ).toBeVisible()
  const resolvedCard = faultCard(page, LONG_FAULT)
  await expect(
    resolvedCard.getByRole("button", { name: "Risolta" }),
  ).toHaveAttribute("aria-pressed", "true")

  const reportedCard = faultCard(page, SECOND_FAULT)
  const reported = reportedCard.getByRole("button", { name: "Comunicata" })
  await reported.click({ clickCount: 2 })
  await expect(reported).toHaveAttribute("aria-pressed", "true")
  await expect(
    faultCard(page, OTHER_BOAT_FAULT).getByRole("button", { name: "Aperta" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("heading", { name: "Da gestire · 2" }),
  ).toBeVisible()

  await capturePixelScreenshot(page, testInfo, "faults-states")
  await page.reload()
  await openFaults(page)
  await expect(
    page.getByRole("heading", { name: "Da gestire · 2" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Storico risolte" }),
  ).toBeVisible()
  await expect(faultCard(page, LONG_FAULT)).toBeVisible()
  await expect(faultCard(page, SECOND_FAULT)).toBeVisible()
  await expect(faultCard(page, OTHER_BOAT_FAULT)).toBeVisible()
  await expect(
    faultCard(page, SECOND_FAULT).getByRole("button", { name: "Comunicata" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    faultCard(page, OTHER_BOAT_FAULT).getByRole("button", { name: "Aperta" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    faultCard(page, LONG_FAULT).getByRole("button", { name: "Risolta" }),
  ).toHaveAttribute("aria-pressed", "true")

  const persistedFaults = await page.evaluate(async () => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(modulePath)) as {
      db: {
        init(): Promise<void>
        getAll(query: string): Promise<Array<Record<string, unknown>>>
      }
    }
    await db.init()
    return db.getAll("SELECT * FROM faults")
  })
  expect(persistedFaults).toHaveLength(3)
  for (const fault of persistedFaults) {
    expect(
      Object.keys(fault).some((key) => /audio|recording|blob/i.test(key)),
    ).toBe(false)
    expect(fault).toEqual(
      expect.objectContaining({
        description: expect.any(String),
        state: expect.stringMatching(/^(open|reported|resolved)$/),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    )
  }
  await capturePixelScreenshot(page, testInfo, "faults-reloaded")
})

test("keeps fault warning and course availability independent after reload", async ({
  page,
}, testInfo) => {
  await createCourse(page)
  await configureBoats(page)
  await openFaults(page)
  await addFault(page, "Scotta da controllare", "RS Quest 2")

  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Barche", exact: true }).click()
  const boat = page.getByRole("button", {
    name: /RS Quest 2, Da controllare, 1 avaria/,
  })
  await expect(boat).toBeVisible()
  await boat.click()
  await expect(page.getByText("Disponibile", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await expect(page.getByText("Non disponibile", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Scotta da controllare", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: /Indietro da RS Quest 2/ }).click()
  await expect(
    page.getByRole("button", {
      name: /RS Quest 2, Non disponibile, 1 avaria/,
    }),
  ).toBeVisible()

  await openFaults(page)
  const fault = faultCard(page, "Scotta da controllare")
  await expect(fault).toBeVisible()
  await expect(fault.getByRole("button", { name: "Aperta" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await capturePixelScreenshot(page, testInfo, "faults-availability")

  await page.reload()
  await openFaults(page)
  await expect(faultCard(page, "Scotta da controllare")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Da gestire · 1" }),
  ).toBeVisible()
})

test("keeps fault identity, preview and direct states usable at 320px and 200% text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await configureBoats(page)
  await openFaults(page)
  await addFault(page, LONG_FAULT, "RS Quest 2")

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })

  const card = faultCard(page, LONG_FAULT)
  await expect(card).toBeVisible()
  await expect(card.getByLabel("RS Quest 2")).toBeVisible()
  await expect(
    card.getByRole("button", { name: `Apri descrizione: ${LONG_FAULT}` }),
  ).toBeVisible()

  const stateGroup = card.getByRole("group", {
    name: `Stato avaria ${LONG_FAULT}`,
  })
  for (const state of ["Aperta", "Comunicata", "Risolta"]) {
    await expect(stateGroup.getByRole("button", { name: state })).toBeVisible()
  }
  await expectNoHorizontalOverflow(page)
})
