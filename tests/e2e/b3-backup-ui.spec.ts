import { expect, type Page, test } from "@playwright/test"

/**
 * B3's Impostazioni section with a fake backend (no network leaves the
 * test): absent without backup, a sign-in link sent to the address typed,
 * and a failure that says why and offers a retry.
 */
const fakeBackend = "https://backup.fake.test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Impostazioni" }).click()
}

/** Impostazioni, unless a reload kept the app there. */
async function openSettings(page: Page) {
  const heading = page.getByRole("heading", { name: "Impostazioni" })
  const button = page.getByRole("button", { name: "Impostazioni" })
  await expect(heading.or(button).first()).toBeVisible()
  if (!(await heading.isVisible())) await button.click()
  await expect(heading).toBeVisible()
}

async function withFakeBackup(page: Page, otpStatus: number) {
  const requests: Array<{ url: string; body: unknown }> = []
  await page.addInitScript((url) => {
    window.__cvcBackupConfig = {
      supabaseUrl: url,
      supabaseKey: "sb_publishable_fake",
      powersyncUrl: "https://sync.fake.test",
    }
  }, fakeBackend)
  await page.route(`${fakeBackend}/**`, async (route) => {
    const request = route.request()
    requests.push({ url: request.url(), body: request.postDataJSON() })
    await route.fulfill({
      status: otpStatus,
      contentType: "application/json",
      body: otpStatus < 300 ? "{}" : '{"msg":"unavailable"}',
    })
  })
  return requests
}

test("a build without backup shows no backup section", async ({ page }) => {
  await createCourse(page)
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Backup online" }),
  ).toHaveCount(0)
})

test("sends the sign-in link to the address typed, returning to the app", async ({
  page,
}) => {
  const requests = await withFakeBackup(page, 200)
  await createCourse(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section).toBeVisible()
  await expect(
    section.getByText("Senza accesso l’app funziona come sempre", {
      exact: false,
    }),
  ).toBeVisible()
  await section.getByLabel("Email").fill("istruttore@example.test")
  await section
    .getByRole("button", { name: "Invia il link di accesso" })
    .click()
  await expect(section.getByRole("status")).toContainText(
    "Link inviato a istruttore@example.test",
  )
  const otp = requests.find(({ url }) => url.includes("/auth/v1/otp"))
  expect(otp?.body).toMatchObject({ email: "istruttore@example.test" })
  // Only accounts made in the backend's dashboard sign in (SP-B3-4).
  expect(otp?.body).toMatchObject({ create_user: false })
  expect(otp?.url).toContain(
    encodeURIComponent(new URL(page.url()).origin + "/"),
  )

  // The app may be closed while the instructor opens the mail (FUX-B3-Q2).
  await page.reload()
  await openSettings(page)
  await expect(section.getByRole("status")).toContainText(
    "Link inviato a istruttore@example.test",
  )
  await section.getByRole("button", { name: "Usa un’altra email" }).click()
  await expect(section.getByLabel("Email")).toBeVisible()
})

test("a failed sign-in request says why and offers nothing it cannot do", async ({
  page,
}) => {
  await withFakeBackup(page, 503)
  await createCourse(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await section.getByLabel("Email").fill("istruttore@example.test")
  await section
    .getByRole("button", { name: "Invia il link di accesso" })
    .click()
  await expect(section.getByRole("alert")).toContainText(
    "Invio non riuscito. Riprova.",
  )
  // The form stays filled: its button is the retry (FUX-B3-Q1).
  await expect(section.getByLabel("Email")).toHaveValue(
    "istruttore@example.test",
  )
  // The course is untouched and still local.
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

const authKey = "cvc-helper.backup-auth"
const account = {
  id: "a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab",
  aud: "authenticated",
  role: "authenticated",
  email: "istruttore@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-01T00:00:00Z",
}
const sessionFor = (expiresIn: number) => ({
  access_token: "fake-access-token",
  token_type: "bearer",
  expires_in: expiresIn,
  expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  refresh_token: "fake-refresh-token",
  user: account,
})

async function storeSession(page: Page, expiresIn: number) {
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [authKey, sessionFor(expiresIn)] as const,
  )
}

/**
 * A fake backend that signs in: the code in the email returns a session,
 * the account holds no course, uploads are refused and the sync service is
 * out of reach, so changes stay queued. `coursesDelay` slows the launch.
 */
async function withSigningInBackup(page: Page, coursesDelay = 0) {
  const requests: Array<{ url: string; body: unknown }> = []
  await page.addInitScript((url) => {
    window.__cvcBackupConfig = {
      supabaseUrl: url,
      supabaseKey: "sb_publishable_fake",
      powersyncUrl: "https://sync.fake.test",
    }
  }, fakeBackend)
  await page.route("https://sync.fake.test/**", (route) => route.abort())
  await page.route(`${fakeBackend}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    requests.push({ url: request.url(), body: request.postDataJSON() })
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    if (path === "/auth/v1/verify") return json(sessionFor(3600))
    if (path === "/auth/v1/otp") return json({})
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 })
    if (path === "/rest/v1/courses" && request.method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, coursesDelay))
      return json([])
    }
    return json({ msg: "unavailable" }, 503)
  })
  return requests
}

test("the code in the email signs in; the course waits to be sent, and Esci asks first", async ({
  page,
}) => {
  const requests = await withSigningInBackup(page)
  await createCourse(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await section.getByLabel("Email").fill("istruttore@example.test")
  await section
    .getByRole("button", { name: "Invia il link di accesso" })
    .click()
  const reopened = page.waitForEvent("load")
  await section.getByLabel("Codice dell’email").fill("123 456")
  await section.getByRole("button", { name: "Accedi con il codice" }).click()
  await reopened
  expect(
    requests.find(({ url }) => url.includes("/auth/v1/verify"))?.body,
  ).toMatchObject({ email: "istruttore@example.test", token: "123456" })

  // The app reopened on synced tables and connects as the account.
  await openSettings(page)
  await expect(section).toContainText("Accesso: istruttore@example.test")
  await expect(section.getByRole("status")).toContainText(
    /In attesa di connessione: \d+ modific[ah]e? da inviare\./,
  )
  await expect(page.getByText("Locale, con backup online")).toBeVisible()

  // A wrong tap on Esci is undone in place (FUX-B3-6).
  await section.getByRole("button", { name: "Esci" }).click()
  await expect(section.getByRole("alertdialog")).toContainText(
    /non (è|sono) ancora online: resta(no)? su questo telefono/,
  )
  await section.getByRole("button", { name: "Resta collegato" }).click()
  await expect(section).toContainText("Accesso: istruttore@example.test")

  await section.getByRole("button", { name: "Esci" }).click()
  await section
    .getByRole("alertdialog")
    .getByRole("button", { name: "Esci" })
    .click()
  await expect(section.getByLabel("Email")).toBeVisible()
  expect(
    await page.evaluate(
      (key) => Object.keys(localStorage).some((name) => name.startsWith(key)),
      authKey,
    ),
  ).toBe(false)
  // Signed out, the course is still here.
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

test("a sign-in finishing while the app is in use never reloads it under the user", async ({
  page,
}) => {
  await withSigningInBackup(page, 2_500)
  await createCourse(page)
  await storeSession(page, 3600)
  let loads = 0
  page.on("load", () => loads++)
  await page.reload()
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  const firstName = page.getByLabel("Nome", { exact: true })
  await firstName.fill("Bravo")
  await page.getByLabel("Cognome", { exact: true }).fill("Digitato")
  // A tap away from the text fields, as on a Sesso option (FUX-B3-3).
  await page.getByRole("radio", { name: "Altro" }).check()

  // Well past the slow launch check: nothing reloaded under the form.
  await page.waitForTimeout(5_000)
  await expect(firstName).toHaveValue("Bravo")
  expect(loads).toBe(1)

  // The switch waits for "Riapri l’app" in Impostazioni.
  await page.getByRole("button", { name: "Annulla" }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await openSettings(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section).toContainText("Backup pronto. Riapri l’app")
  await section.getByRole("button", { name: "Riapri l’app" }).click()
  await expect(section).toContainText("Accesso: istruttore@example.test", {
    timeout: 30_000,
  })
})

test("an expired or foreign link says so and leaves the address clean", async ({
  page,
}) => {
  await withSigningInBackup(page)
  await createCourse(page)
  // A link opens the app afresh, not as a jump within the open page.
  await page.goto("about:blank")
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  )
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe("")
  await openSettings(page)
  await expect(
    page.getByRole("region", { name: "Backup online" }).getByRole("alert"),
  ).toContainText("Il link è scaduto, già usato o aperto in un altro browser")
})

test("offline the morning after, an expired session stays signed in and says so", async ({
  page,
}) => {
  await withSigningInBackup(page)
  await createCourse(page)
  // Signed in the evening before: the device switches and reopens.
  await storeSession(page, 3600)
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
  await page.waitForEvent("load")
  await openSettings(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section).toContainText("Accesso: istruttore@example.test")

  // Next morning: the token expired overnight and there is no signal.
  await storeSession(page, -600)
  await page.route(`${fakeBackend}/auth/v1/token**`, (route) => route.abort())
  await page.reload()
  await openSettings(page)
  await expect(section).toContainText("Accesso: istruttore@example.test")
  await expect(section.getByRole("status")).toContainText(
    "In attesa di connessione",
  )
  await expect(section.getByLabel("Email")).toHaveCount(0)
})
