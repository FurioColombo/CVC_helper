import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { expect, type Locator, type Page, test } from "@playwright/test"
import type {
  DictationError,
  DictationStatus,
} from "@/features/speech/useDictation"

const SUBJECT =
  "nota sintetica di Alessandra Bernardeschi per sabato pomeriggio"
const SYNTHETIC_NOTE = "Una nota sintetica prima della dettatura."
const STRESS_VIEWPORT = { width: 320, height: 664 }
const NORMAL_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function addStudent(page: Page) {
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Alessandra")
  await page.getByLabel("Cognome", { exact: true }).fill("Bernardeschi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("F", { exact: true })
    .click()
}

async function enableStressText(page: Page) {
  await page.setViewportSize(STRESS_VIEWPORT)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
}

async function expectPageAndPanelFit(page: Page, panel?: Locator) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.clientWidth,
  )

  if (!panel) return
  const geometry = await panel.evaluate((element) => {
    const boundary = element.getBoundingClientRect()
    const offenders = Array.from(element.querySelectorAll<HTMLElement>("*"))
      .map((child) => {
        const box = child.getBoundingClientRect()
        return {
          ariaLabel: child.getAttribute("aria-label"),
          left: Math.round(box.left),
          right: Math.round(box.right),
          tag: child.tagName,
        }
      })
      .filter(
        ({ left, right }) =>
          left < Math.floor(boundary.left) || right > Math.ceil(boundary.right),
      )
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      offenders,
    }
  })
  expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(
    geometry.clientWidth,
  )
  expect(geometry.offenders, JSON.stringify(geometry)).toEqual([])
}

async function expect44Px(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
}

async function measureGeometry(region: Locator, host: string, state: string) {
  return region.evaluate(
    (element, metadata) => {
      const rect = (target: Element | null) => {
        if (!(target instanceof HTMLElement)) return null
        const box = target.getBoundingClientRect()
        return {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      }
      const named = (prefix: string) =>
        element.querySelector<HTMLElement>(`button[aria-label^="${prefix}"]`)
      const statusPanel = element.querySelector<HTMLElement>("[role=status]")
      const alertPanel = element.querySelector<HTMLElement>("[role=alert]")
      return {
        host: metadata.host,
        state: metadata.state,
        viewportWidth: window.innerWidth,
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
        page: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        },
        region: {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          rect: rect(element),
        },
        hostLabel: rect(element.querySelector("label")),
        trigger: rect(
          named("Detta la nota sintetica") ?? named("Termina dettatura"),
        ),
        waveform: rect(element.querySelector("canvas")),
        status: statusPanel
          ? {
              clientWidth: statusPanel.clientWidth,
              scrollWidth: statusPanel.scrollWidth,
              rect: rect(statusPanel),
              text: rect(statusPanel.querySelector("p")),
              cancel: rect(named("Annulla dettatura")),
            }
          : null,
        alert: alertPanel
          ? {
              clientWidth: alertPanel.clientWidth,
              scrollWidth: alertPanel.scrollWidth,
              rect: rect(alertPanel),
              text: rect(alertPanel.querySelector("p")),
              retry: rect(named("Riprovare dettatura")),
            }
          : null,
      }
    },
    { host, state },
  )
}

async function expectPermissionError(
  page: Page,
  buttonName: string,
  subject: string,
  note: Locator,
  expectedText = SYNTHETIC_NOTE,
) {
  const trigger = page.getByRole("button", { name: buttonName, exact: true })
  await expect44Px(trigger)
  await trigger.click()
  const alert = page.getByRole("alert").last()
  await expect(alert).toContainText("Permesso microfono non concesso")
  await expect(alert).toContainText("Il testo è rimasto invariato")
  const retry = alert.getByRole("button", {
    name: `Riprovare dettatura ${subject}`,
  })
  await expect44Px(retry)
  await expectPageAndPanelFit(page, alert)
  await expect(note).toHaveValue(expectedText)
  await retry.click()
  await expect(alert).toContainText("Permesso microfono non concesso")
  await expect(note).toHaveValue(expectedText)
  await expect44Px(retry)
  await expectPageAndPanelFit(page, alert)
}

test("shared controls fit every dictation state at stress and ordinary widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The synthetic state matrix runs once; real-host checks use the same browser.",
  )

  const evidenceDirectory = path.resolve(".evidence/V02")
  const geometry: Array<Awaited<ReturnType<typeof measureGeometry>>> = []
  await mkdir(evidenceDirectory, { recursive: true })

  for (const host of [
    "student",
    "evaluation",
    "knowledge",
    "fault-form",
    "fault-card-edit",
  ]) {
    await page.setViewportSize(STRESS_VIEWPORT)
    await page.goto(`/tests/fixtures/dictation-layout.html?host=${host}`)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    const region = page.getByRole("region", { name: `Campo sintetico ${host}` })
    await expect(region).toBeVisible()
    if (host === "evaluation") {
      const labelBox = await region.locator("label").boundingBox()
      const triggerBox = await region
        .getByRole("button", {
          name: "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
        })
        .boundingBox()
      expect(labelBox).not.toBeNull()
      expect(triggerBox).not.toBeNull()
      expect(triggerBox!.y).toBeGreaterThanOrEqual(
        labelBox!.y + labelBox!.height,
      )
    }

    const cases: Array<{
      status: DictationStatus
      progress?: number
      error?: DictationError | null
      liveText: string
    }> = [
      { status: "idle", liveText: "" },
      { status: "permission", liveText: "Attendo il permesso" },
      { status: "loading", progress: 1, liveText: "1%" },
      { status: "loading", progress: 100, liveText: "100%" },
      { status: "recording", liveText: "Registrazione in corso" },
      { status: "processing", liveText: "Elaborazione locale" },
      {
        status: "error",
        error: "transcription",
        liveText: "Dettatura non riuscita",
      },
      {
        status: "error",
        error: "permission",
        liveText: "Permesso microfono non concesso",
      },
    ]

    for (const scenario of cases) {
      if (scenario.status === "idle") {
        geometry.push(await measureGeometry(region, host, "idle"))
        await region
          .getByRole("button", {
            name: "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
          })
          .focus()
        await page.keyboard.press("Enter")
        await expect(region.getByRole("status")).toContainText(
          "Attendo il permesso",
        )
        await expectPageAndPanelFit(page, region)
        continue
      }

      await page.evaluate(({ status, progress, error }) => {
        window.setDictationFixtureState?.(status, progress, error)
      }, scenario)

      const triggerName =
        scenario.status === "recording"
          ? `Termina dettatura ${SUBJECT}`
          : "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio"
      const trigger = region.getByRole("button", { name: triggerName })
      await expect44Px(trigger)
      const stateName =
        scenario.status === "loading"
          ? `loading-${scenario.progress}`
          : scenario.status
      geometry.push(await measureGeometry(region, host, stateName))

      if (
        scenario.status === "permission" ||
        scenario.status === "loading" ||
        scenario.status === "recording" ||
        scenario.status === "processing"
      ) {
        const status = region.getByRole("status")
        await expect(status).toContainText(scenario.liveText)
        const cancel = status.getByRole("button", {
          name: `Annulla dettatura ${SUBJECT}`,
        })
        await expect44Px(cancel)
        const statusTextBox = await status.locator("p").boundingBox()
        const cancelBox = await cancel.boundingBox()
        expect(statusTextBox).not.toBeNull()
        expect(cancelBox).not.toBeNull()
        expect(statusTextBox!.width).toBeGreaterThanOrEqual(120)
        expect(cancelBox!.y).toBeGreaterThanOrEqual(
          statusTextBox!.y + statusTextBox!.height,
        )
        await expectPageAndPanelFit(page, status)
        if (scenario.status === "permission") {
          await cancel.focus()
          await page.keyboard.press("Enter")
          await expect(region.getByRole("status")).toHaveCount(0)
          await expect(
            region.getByRole("button", {
              name: "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
            }),
          ).toBeEnabled()
        }
      } else if (scenario.status === "error") {
        const alert = region.getByRole("alert")
        await expect(alert).toContainText(scenario.liveText)
        const alertTextBox = await alert.locator("p").boundingBox()
        const retry = alert.getByRole("button", {
          name: `Riprovare dettatura ${SUBJECT}`,
        })
        await expect44Px(retry)
        const retryBox = await retry.boundingBox()
        expect(alertTextBox).not.toBeNull()
        expect(retryBox).not.toBeNull()
        expect(alertTextBox!.width).toBeGreaterThanOrEqual(120)
        expect(retryBox!.y).toBeGreaterThanOrEqual(
          alertTextBox!.y + alertTextBox!.height,
        )
        await expectPageAndPanelFit(page, alert)
      }
      await expectPageAndPanelFit(page, region)
      if (
        host === "evaluation" &&
        scenario.status === "loading" &&
        scenario.progress === 100
      ) {
        await page.screenshot({
          fullPage: true,
          path: path.join(
            evidenceDirectory,
            "evaluation-loading-100-stress.png",
          ),
        })
      }
      if (host === "student" && scenario.status === "recording") {
        await page.screenshot({
          fullPage: true,
          path: path.join(evidenceDirectory, "student-recording-stress.png"),
        })
      }
    }

    await page.evaluate(() => {
      document.documentElement.style.fontSize = ""
    })
    for (const viewport of NORMAL_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.evaluate(() => {
        window.setDictationFixtureState?.("recording")
      })
      await expect(region.locator("canvas")).toBeVisible()
      await expectPageAndPanelFit(page, region)
    }

    await page.setViewportSize(STRESS_VIEWPORT)
    await page.goto("/tests/fixtures/dictation-layout.html?host=unsupported")
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    const unsupported = page.getByRole("region", {
      name: "Campo sintetico unsupported",
    })
    await expect(
      unsupported.getByText("Dettatura non disponibile in questo browser."),
    ).toBeVisible()
    await expect(
      unsupported.getByRole("button", {
        name: "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
      }),
    ).toBeDisabled()
    await expectPageAndPanelFit(page, unsupported)
    geometry.push(await measureGeometry(unsupported, "unsupported", "idle"))

    await page.setViewportSize(STRESS_VIEWPORT)
    await page.goto(`/tests/fixtures/dictation-layout.html?host=${host}`)
    const ordinaryRegion = page.getByRole("region", {
      name: `Campo sintetico ${host}`,
    })
    await page.evaluate(() => {
      document.documentElement.style.fontSize = ""
      window.setDictationFixtureState?.("recording")
    })
    for (const viewport of NORMAL_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await expect(ordinaryRegion.locator("canvas")).toBeVisible()
      await expectPageAndPanelFit(page, ordinaryRegion)
      geometry.push(await measureGeometry(ordinaryRegion, host, "recording"))
    }
  }

  await writeFile(
    path.join(evidenceDirectory, "control-geometry.json"),
    `${JSON.stringify(
      {
        command:
          "npm.cmd run verify:e2e -- v02-dictation-layout.spec.ts --project=pixel-7-chrome",
        runtime: process.version,
        measuredAt: new Date().toISOString(),
        measurements: geometry,
      },
      null,
      2,
    )}\n`,
  )
})

test("real student create, P05 and P17 note hosts preserve typed text on denial", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7-chrome")
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
  await addStudent(page)
  const initialNote = page.getByRole("textbox", { name: "Nota iniziale" })
  await initialNote.fill(SYNTHETIC_NOTE)
  const courseNote = page.getByRole("textbox", { name: "Nota del corso" })
  await courseNote.fill(SYNTHETIC_NOTE)
  await enableStressText(page)
  await expectPermissionError(
    page,
    "Detta nota iniziale",
    "nota iniziale",
    initialNote,
  )
  await expect(initialNote).toHaveValue(SYNTHETIC_NOTE)
  await expectPermissionError(
    page,
    "Detta nota del corso",
    "nota del corso",
    courseNote,
  )
  await expect(courseNote).toHaveValue(SYNTHETIC_NOTE)

  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(
    page.getByRole("button", { name: /Alessandra, 26 anni/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: /Alessandra, 26 anni/ }).click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  const editNote = page.getByRole("textbox", { name: "Nota iniziale" })
  const editText = "Testo sintetico inserito nella modifica allievo."
  await editNote.fill(editText)
  await enableStressText(page)
  await expectPermissionError(
    page,
    "Detta nota iniziale",
    "nota iniziale",
    editNote,
    editText,
  )
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()

  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()
  await page.getByRole("button", { name: /Nota di Alessandra/ }).click()
  const knowledgeNote = page.getByRole("textbox", {
    name: "Nota iniziale di Alessandra",
  })
  await knowledgeNote.fill(SYNTHETIC_NOTE)
  await enableStressText(page)
  await expectPermissionError(
    page,
    "Detta nota di Alessandra",
    "di Alessandra",
    knowledgeNote,
  )
  await expect(knowledgeNote).toHaveValue(SYNTHETIC_NOTE)
  await page.getByRole("button", { name: "Chiudi nota di Alessandra" }).click()
  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Alessandra" })
    .click()
  const evaluationNote = page.getByRole("textbox", {
    name: "Nota valutazione di Alessandra",
  })
  await evaluationNote.fill(SYNTHETIC_NOTE)
  await enableStressText(page)
  await expectPermissionError(
    page,
    "Detta nota valutazione di Alessandra",
    "valutazione di Alessandra",
    evaluationNote,
  )
  await expect(evaluationNote).toHaveValue(SYNTHETIC_NOTE)

  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.getByRole("button", { name: "Annulla", exact: true }).click()
  for (const viewport of NORMAL_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.getByRole("button", { name: "Valutazioni" }).waitFor()
    await expectPageAndPanelFit(page)
  }
})

test("fault form and open-card edit keep dictation controls inside the card", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7-chrome")
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
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("2")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "Avarie", exact: true }).click()
  await page.getByRole("button", { name: "Segnala avaria" }).click()
  const faultDescription = page.getByRole("textbox", { name: "Descrizione" })
  await faultDescription.fill(SYNTHETIC_NOTE)
  await enableStressText(page)
  await expectPermissionError(page, "Detta avaria", "avaria", faultDescription)
  await expect(faultDescription).toHaveValue(SYNTHETIC_NOTE)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.getByRole("button", { name: "Salva avaria" }).click()

  const faultCard = page
    .getByRole("article")
    .filter({ hasText: SYNTHETIC_NOTE })
  await expect(faultCard).toBeVisible()
  await faultCard
    .getByRole("button", { name: `Modifica avaria ${SYNTHETIC_NOTE}` })
    .click()
  const cardTextarea = faultCard.getByRole("textbox", { name: "Descrizione" })
  await expect(cardTextarea).toBeVisible()
  await enableStressText(page)
  await expectPermissionError(
    page,
    "Detta descrizione avaria",
    "descrizione avaria",
    cardTextarea,
  )
  await expect(cardTextarea).toHaveValue(SYNTHETIC_NOTE)
  await expectPageAndPanelFit(page, faultCard)

  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  for (const viewport of NORMAL_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await expectPageAndPanelFit(page, faultCard)
  }
})
