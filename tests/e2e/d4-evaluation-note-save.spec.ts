import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

test("keeps the next student's draft when a previous note save finishes", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  for (const [firstName, surname] of [
    ["Aldo", "Rossi"],
    ["Bea", "Verdi"],
  ] as const) {
    await page.getByRole("button", { name: "Aggiungi allievo" }).click()
    await page.getByLabel("Nome", { exact: true }).fill(firstName)
    await page.getByLabel("Cognome", { exact: true }).fill(surname)
    await page.getByLabel("Età compiuta il primo giorno del corso").fill("26")
    await page
      .getByRole("group", { name: "Sesso" })
      .getByText("M", { exact: true })
      .click()
    await page.getByRole("button", { name: "Salva allievo" }).click()
  }
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")

  // Hold only the next real transaction's completion. All note edits and save
  // actions below use the UI; releasing this promise commits the original SQL.
  await page.evaluate(async () => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = await import(/* @vite-ignore */ modulePath)
    const writable = db as {
      writeTransaction: (
        callback: (transaction: unknown) => Promise<unknown>,
        ...args: unknown[]
      ) => Promise<unknown>
    }
    const original = writable.writeTransaction.bind(db)
    let release: (() => void) | undefined
    let held: Promise<void>
    let holdNext = false
    const state = {
      reached: false,
      release: () => release?.(),
      arm: () => {
        held = new Promise<void>((resolve) => {
          release = resolve
        })
        state.reached = false
        holdNext = true
      },
    }
    state.arm()
    Object.assign(window, { __D4_NOTE_SAVE__: state })
    writable.writeTransaction = (callback, ...args) => {
      if (!holdNext) return original(callback, ...args)
      holdNext = false
      return original(
        async (transaction) => {
          const result = await callback(transaction)
          state.reached = true
          await held
          return result
        },
        ...args,
      )
    }
  })

  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Aldo" })
    .fill("Nota di Aldo, prima scrittura")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Aldo"),
  ).toHaveText("Salvataggio…")
  await page.waitForFunction(
    () =>
      (window as Window & { __D4_NOTE_SAVE__?: { reached: boolean } })
        .__D4_NOTE_SAVE__?.reached === true,
  )
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Bea" })
    .click()
  const nextNote = page.getByRole("textbox", {
    name: "Nota valutazione di Bea",
  })
  await nextNote.fill("Bozza di Bea da conservare")

  await page.evaluate(() => {
    const state = (
      window as Window & { __D4_NOTE_SAVE__?: { release: () => void } }
    ).__D4_NOTE_SAVE__
    if (!state) throw new Error("Missing synthetic note-save barrier")
    state.release()
  })
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Aldo"),
  ).toHaveText("Salvato")
  await expect(nextNote).toBeVisible()
  await expect(nextNote).toHaveValue("Bozza di Bea da conservare")
  const screenshot = evidenceOutputPath(
    testInfo,
    "D4",
    `next-note-preserved-${testInfo.project.name}.png`,
  )
  mkdirSync(path.dirname(screenshot), { recursive: true })
  await page.screenshot({ path: screenshot })

  // A second submission stays editable while its real transaction is pending.
  // Its completion must retain text typed after that submission, too.
  await page.evaluate(() => {
    const state = (
      window as Window & { __D4_NOTE_SAVE__?: { arm: () => void } }
    ).__D4_NOTE_SAVE__
    if (!state) throw new Error("Missing synthetic note-save barrier")
    state.arm()
  })
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvataggio…")
  await page.waitForFunction(
    () =>
      (window as Window & { __D4_NOTE_SAVE__?: { reached: boolean } })
        .__D4_NOTE_SAVE__?.reached === true,
  )
  const latestNote = "Bozza di Bea aggiornata durante il salvataggio"
  await expect(nextNote).toBeEnabled()
  await nextNote.fill(latestNote)
  await page.evaluate(() => {
    const state = (
      window as Window & { __D4_NOTE_SAVE__?: { release: () => void } }
    ).__D4_NOTE_SAVE__
    if (!state) throw new Error("Missing synthetic note-save barrier")
    state.release()
  })
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvato")
  await expect(nextNote).toBeVisible()
  await expect(nextNote).toHaveValue(latestNote)
  await page.screenshot({
    path: evidenceOutputPath(
      testInfo,
      "D4",
      `latest-note-preserved-${testInfo.project.name}.png`,
    ),
  })
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvato")
  await expect(nextNote).toHaveCount(0)

  await page.reload()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  for (const [name, note] of [
    ["Aldo", "Nota di Aldo, prima scrittura"],
    ["Bea", latestNote],
  ] as const) {
    await page
      .getByRole("button", { name: `Modifica nota valutazione di ${name}` })
      .click()
    await expect(
      page.getByRole("textbox", { name: `Nota valutazione di ${name}` }),
    ).toHaveValue(note)
    await page.getByRole("button", { name: "Annulla" }).click()
  }
})
