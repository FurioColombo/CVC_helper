import { expect, test, type Locator } from "@playwright/test"

/**
 * V05: the assistant path of Scan allievi. The operator copies a prompt,
 * pastes a fictitious answer back, fixes one bad line in place and leaves
 * another out, checks every row and saves — all without the app itself
 * making a single network call.
 *
 * Follow-up to the V05 review (round 1): saving must stay blocked while any
 * unread line remains (V5-3), and the pasted birth date must stay visible for
 * comparison against the sheet (V5-2).
 */

const ROSTER_PASTE_BEGIN = "CVC-ALLIEVI v1"
const ROSTER_PASTE_HEADER = "Cognome;Nome;Data di nascita;Età;Telefono"
const ROSTER_PASTE_END = "FINE"

/** Each row's own birth date input, read in sheet order (`toHaveValues` is
 * for a single `<select multiple>`, not several separate `<input>`s). */
async function dateOfBirthValues(locator: Locator) {
  return locator.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  )
}

test("copies the prompt, reads a pasted answer, fixes or leaves out every unread line, and saves with no network call", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await page.getByRole("button", { name: "Scan allievi", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Scan allievi" }),
  ).toBeVisible()

  const cameraButton = page.getByRole("button", { name: "Fai una foto" })
  const assistantToggle = page.getByRole("button", {
    name: "Oppure usa un assistente",
  })
  await expect(cameraButton).toBeVisible()
  await expect(assistantToggle).toBeVisible()
  // The camera path stays first: it must sit above the assistant section on
  // the same idle screen, never the other way around.
  const cameraBox = await cameraButton.boundingBox()
  const assistantBox = await assistantToggle.boundingBox()
  expect(cameraBox).not.toBeNull()
  expect(assistantBox).not.toBeNull()
  expect(cameraBox!.y).toBeLessThan(assistantBox!.y)

  // Record every network request from the moment the assistant section opens
  // until the save completes. The app must never contact an assistant, or
  // anything else, itself — and a regression that POSTs the pasted roster to
  // the app's own origin must be caught too (V05 review V5R2-9), not just one
  // that reaches out to a foreign host.
  const requests: { url: string; method: string }[] = []
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method() }),
  )

  await assistantToggle.click()
  const ownOrigin = new URL(page.url()).origin

  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  }

  await page.getByRole("button", { name: "Copia istruzioni" }).click()

  // Whether the write actually succeeds depends on the browser's own
  // clipboard permission model, not on which engine runs it: WebKit can
  // allow a user-gesture write with no permission grant at all, so it lands
  // on the same success state chromium reaches only after being granted
  // permission. Either outcome must leave the prompt reachable.
  const copiedButton = page.getByRole("button", { name: "Copiate" })
  const fallbackTextbox = page.getByRole("textbox", {
    name: "Non sono riuscito a copiare: seleziona e copia il testo qui sotto",
  })
  await expect(copiedButton.or(fallbackTextbox)).toBeVisible()
  if (browserName === "chromium") {
    // Permission was explicitly granted above, so this engine must always
    // reach the success state, with the clipboard actually holding the text.
    await expect(copiedButton).toBeVisible()
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    )
    expect(clipboardText).toContain(ROSTER_PASTE_BEGIN)
  }

  // A fictitious answer with two bad lines otherwise matching the stated
  // format: one worth fixing in place (an impossible date), one worth
  // leaving out entirely (not a name at all).
  const answer = [
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "Bianchi;Sara;12/04/2011;;",
    "Verdi;Luca;31/13/2010;;",
    "1;1;;;",
    ROSTER_PASTE_END,
  ].join("\n")
  await page.getByLabel("Risposta dell’assistente").fill(answer)
  await page.getByRole("button", { name: "Leggi risposta" }).click()

  const reviewHeading = page.getByRole("heading", {
    name: "Controlla prima di salvare",
  })
  await expect(reviewHeading).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Righe non lette (2)" }),
  ).toBeVisible()
  await expect(
    page.getByText("data di nascita non valida (GG/MM/AAAA)"),
  ).toBeVisible()
  await expect(page.getByText("cognome non valido")).toBeVisible()

  // The one row read cleanly already shows its birth date for comparison
  // against the sheet, rather than hiding it behind a printed age (V5-2).
  await expect(page.getByLabel(/^Data di nascita riga/).first()).toHaveValue(
    "2011-04-12",
  )

  const badLineInput = page.getByLabel("Testo riga 4")
  // Two unread lines are on screen; scope to line 4's own row so its
  // "Rileggi riga" is not ambiguous with the other line's.
  const badLineRow = badLineInput.locator("xpath=ancestor::div[1]")
  await expect(badLineInput).toHaveValue("Verdi;Luca;31/13/2010;;")
  await badLineInput.fill("Verdi;Luca;13/03/2010;;")
  await badLineRow.getByRole("button", { name: "Rileggi riga" }).click()

  await expect(
    page.getByRole("heading", { name: "Righe non lette (1)" }),
  ).toBeVisible()
  await expect
    .poll(() => dateOfBirthValues(page.getByLabel(/^Data di nascita riga/)))
    .toEqual(["2011-04-12", "2010-03-13"])

  // One unread line still remains: saving must stay blocked and the review
  // screen must stay put, rather than silently dropping that line (V5-3).
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(reviewHeading).toBeVisible()

  await page.getByRole("button", { name: "Lascia fuori" }).click()
  await expect(
    page.getByRole("heading", { name: /Righe non lette/ }),
  ).toHaveCount(0)

  const checkButtons = page.getByRole("button", {
    name: /^Segna controllata la riga di allievo \d+$/,
  })
  await expect(checkButtons).toHaveCount(2)
  const checkCount = await checkButtons.count()
  for (let index = 0; index < checkCount; index += 1) {
    await checkButtons.nth(index).click()
  }

  // The date stays visible and correct right up to the save.
  expect(
    await dateOfBirthValues(page.getByLabel(/^Data di nascita riga/)),
  ).toEqual(["2011-04-12", "2010-03-13"])

  // Every row is checked, but the sheet's completeness has not been
  // confirmed yet: saving must stay blocked (V05 review V5R2-3).
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(reviewHeading).toBeVisible()

  await page.getByRole("button", { name: "Sono tutti" }).click()
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Sara,/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Luca,/ })).toBeVisible()

  const foreignHosts = [
    ...new Set(requests.map(({ url }) => new URL(url).host)),
  ].filter((host) => host !== new URL(ownOrigin).host)
  expect(foreignHosts).toEqual([])

  // Every recorded request, same-origin included, was a plain page/asset GET:
  // nothing sent the pasted roster anywhere, not even back to this origin.
  const nonGetRequests = requests.filter(({ method }) => method !== "GET")
  expect(nonGetRequests).toEqual([])

  // No pasted value ever shows up in a request URL either, on any host,
  // including this app's own origin (V05 review V5F-5): the GET/foreign-host
  // checks above would miss a regression that smuggled the roster into a
  // query string on an otherwise ordinary same-origin GET, and a value
  // hidden behind percent-encoding must not slip past a plain substring
  // check.
  const pastedValues = [
    "Bianchi",
    "Verdi",
    "Sara",
    "Luca",
    "12/04/2011",
    "31/13/2010",
    "13/03/2010",
  ]
  for (const { url } of requests) {
    let decoded: string
    try {
      decoded = decodeURIComponent(url)
    } catch {
      decoded = url
    }
    for (const value of pastedValues) {
      expect(decoded).not.toContain(value)
    }
  }
})
