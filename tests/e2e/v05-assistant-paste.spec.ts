import { expect, test, type Locator } from "@playwright/test"

/**
 * V05: the assistant path of Scan allievi. The operator copies a prompt,
 * pastes a fictitious answer back, fixes one bad line in place and leaves
 * another out, then saves — all without the app itself making a single
 * network call.
 *
 * F2 (owner's 2026-09-28 feedback): the paste is trusted, so no row needs its
 * own check any more (only the sheet's completeness confirmation and any
 * unread line or duplicate still do); the review shows the age, never a date
 * field, on this path either; and every Unicode line terminator a phone's
 * copy path can produce, or every line break turned into a plain space by
 * one, still reads correctly.
 *
 * Follow-up to the V05 review (round 1): saving must stay blocked while any
 * unread line remains (V5-3).
 */

const ROSTER_PASTE_BEGIN = "CVC-ALLIEVI v1"
const ROSTER_PASTE_HEADER = "Cognome;Nome;Data di nascita;Età;Telefono"
const ROSTER_PASTE_END = "FINE"

/** Several separate `<input>`s' own values, read in sheet order (`toHaveValues`
 * is for a single `<select multiple>`, not several separate `<input>`s). */
async function inputValues(locator: Locator) {
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
    // F2: the prompt keeps its line breaks through a phone's own copy path by
    // asking for the answer inside one code block, with its own copy button.
    expect(clipboardText).toContain("```")
  }

  // A fictitious answer with two bad lines otherwise matching the stated
  // format: one worth fixing in place (an impossible date and no age, so
  // nothing to fall back on), one worth leaving out entirely (not a name at
  // all). The fix adds the age, so the expected values do not depend on the
  // day the test happens to run.
  const answer = [
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "Bianchi;Sara;12/04/2011;15;",
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

  // The paste is trusted (owner decision 2026-09-28): the row read cleanly
  // shows its age, never a date field. Segna controllata stays available as
  // a general per-row marker, but nothing below requires tapping it.
  await expect(page.getByLabel(/^Età riga/).first()).toHaveValue("15")
  await expect(page.getByLabel(/^Data di nascita riga/)).toHaveCount(0)

  const badLineInput = page.getByLabel("Testo riga 4")
  // Two unread lines are on screen; scope to line 4's own row so its
  // "Rileggi riga" is not ambiguous with the other line's.
  const badLineRow = badLineInput.locator("xpath=ancestor::div[1]")
  await expect(badLineInput).toHaveValue("Verdi;Luca;31/13/2010;;")
  await badLineInput.fill("Verdi;Luca;;14;")
  await badLineRow.getByRole("button", { name: "Rileggi riga" }).click()

  await expect(
    page.getByRole("heading", { name: "Righe non lette (1)" }),
  ).toBeVisible()
  await expect(page.getByLabel(/^Età riga/).nth(1)).toHaveValue("14")

  // One unread line still remains: saving must stay blocked and the review
  // screen must stay put, rather than silently dropping that line (V5-3).
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(reviewHeading).toBeVisible()

  await page.getByRole("button", { name: "Lascia fuori" }).click()
  await expect(
    page.getByRole("heading", { name: /Righe non lette/ }),
  ).toHaveCount(0)

  // Neither row was ever checked on its own: nothing but the sheet's
  // completeness confirmation stands between them and saving.
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(reviewHeading).toBeVisible()

  await page.getByRole("button", { name: "Sono tutti" }).click()
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Sara,.*15 anni/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Luca,.*14 anni/ }),
  ).toBeVisible()

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

/**
 * Records every network request and asserts none of them left this origin,
 * carried a non-GET method, or leaked a pasted value: the same safety net
 * the main journey above checks in full, reused for each phone-paste variant
 * below so a tolerance fix cannot quietly grow a network call.
 */
function watchForNetworkLeaks(page: import("@playwright/test").Page) {
  const requests: { url: string; method: string }[] = []
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method() }),
  )
  return {
    assertNone(ownOrigin: string, pastedValues: string[]) {
      const foreignHosts = [
        ...new Set(requests.map(({ url }) => new URL(url).host)),
      ].filter((host) => host !== new URL(ownOrigin).host)
      expect(foreignHosts).toEqual([])
      expect(requests.filter(({ method }) => method !== "GET")).toEqual([])
      for (const { url } of requests) {
        let decoded: string
        try {
          decoded = decodeURIComponent(url)
        } catch {
          decoded = url
        }
        for (const value of pastedValues) expect(decoded).not.toContain(value)
      }
    },
  }
}

async function openAssistantSection(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Scan allievi", exact: true }).click()
  await page.getByRole("button", { name: "Oppure usa un assistente" }).click()
  return new URL(page.url()).origin
}

// F2: the ChatGPT app's copy button on an Android phone delivered U+2028 line
// separators; a textarea still renders each as a line break, so the answer
// looked unchanged and yet was refused as out of format.
test("reads an answer pasted with U+2028 line separators", async ({ page }) => {
  const ownOrigin = await openAssistantSection(page)
  const watch = watchForNetworkLeaks(page)
  const separator = String.fromCharCode(8232) // U+2028

  const answer = [
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "Bianchi;Sara;12/04/2011;15;",
    "Verdi;Luca;13/03/2010;14;",
    ROSTER_PASTE_END,
  ].join(separator)
  await page.getByLabel("Risposta dell’assistente").fill(answer)
  await page.getByRole("button", { name: "Leggi risposta" }).click()

  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible()
  await expect(page.getByText(/non è nel formato richiesto/)).toHaveCount(0)
  expect(await inputValues(page.getByLabel(/^Cognome riga/))).toEqual([
    "Bianchi",
    "Verdi",
  ])
  await expect(page.getByLabel(/^Età riga/).first()).toHaveValue("15")

  await page.getByRole("button", { name: "Sono tutti" }).click()
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Sara,/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Luca,/ })).toBeVisible()

  watch.assertNone(ownOrigin, ["Bianchi", "Verdi", "Sara", "Luca"])
})

// F2: a phone or chat app can turn every line break into a plain space,
// joining the header, every row and FINE into one paragraph that still
// looks unchanged in a textarea. The parser rebuilds the rows from the
// fixed five-field structure instead of refusing the whole answer.
test("reads an answer whose line breaks were all turned into spaces", async ({
  page,
}) => {
  const ownOrigin = await openAssistantSection(page)
  const watch = watchForNetworkLeaks(page)

  const answer = [
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "Bianchi;Sara;12/04/2011;15;",
    "De Luca;Elsa;13/03/2010;14;",
    ROSTER_PASTE_END,
  ].join(" ")
  await page.getByLabel("Risposta dell’assistente").fill(answer)
  await page.getByRole("button", { name: "Leggi risposta" }).click()

  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible()
  await expect(page.getByText(/non è nel formato richiesto/)).toHaveCount(0)
  expect(await inputValues(page.getByLabel(/^Cognome riga/))).toEqual([
    "Bianchi",
    "De Luca",
  ])
  expect(await inputValues(page.getByLabel(/^Nome riga/))).toEqual([
    "Sara",
    "Elsa",
  ])
  await expect(page.getByLabel(/^Età riga/).nth(1)).toHaveValue("14")

  await page.getByRole("button", { name: "Sono tutti" }).click()
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Sara,/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Elsa,/ })).toBeVisible()

  watch.assertNone(ownOrigin, ["Bianchi", "De Luca", "Sara", "Elsa"])
})

// Task 4 (owner, 2026-09-28): the three-dot menu and the empty Allievi page
// used to open a different pair of methods; both now list the same three
// (manual, scan, assistant), in the same order, and the empty page's own
// scan and assistant options open the right screens.
test("offers the same methods from the empty Allievi page and the menu, and opens the right screen for each", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Nessun allievo" }),
  ).toBeVisible()

  const emptyPageMethods = page.getByRole("button", {
    name: /^(Aggiungi allievo|Scan allievi|Usa un assistente)$/,
  })
  await expect(emptyPageMethods).toHaveText([
    "Aggiungi allievo",
    "Scan allievi",
    "Usa un assistente",
  ])

  await page.getByRole("button", { name: "Menu allievi" }).click()
  const menuMethods = page.getByLabel("Azioni allievi").getByRole("button", {
    name: /^(Aggiungi allievo|Scan allievi|Usa un assistente)$/,
  })
  await expect(menuMethods).toHaveText([
    "Aggiungi allievo",
    "Scan allievi",
    "Usa un assistente",
  ])
  // Close the menu without picking anything, so the empty page's own copy is
  // the only one left in a moment.
  await page.getByRole("button", { name: "Menu allievi" }).click()

  // The empty page's "Usa un assistente" opens Scan allievi with the
  // assistant section already expanded, without an extra tap to open it.
  await page.getByRole("button", { name: "Usa un assistente" }).click()
  await expect(
    page.getByRole("heading", { name: "Scan allievi" }),
  ).toBeVisible()
  await expect(page.getByLabel("Risposta dell’assistente")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Scan allievi" }).click()

  // "Scan allievi" still opens the same screen collapsed, ready for the
  // camera first (unchanged from before Task 4).
  await expect(
    page.getByRole("heading", { name: "Nessun allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Scan allievi" }).click()
  await expect(
    page.getByRole("heading", { name: "Scan allievi" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Fai una foto" })).toBeVisible()
  await expect(page.getByLabel("Risposta dell’assistente")).not.toBeVisible()
})
