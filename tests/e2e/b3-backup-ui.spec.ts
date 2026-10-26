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
  expect(JSON.stringify(otp?.body)).toContain("create_user")
  expect(otp?.url).toContain(
    encodeURIComponent(new URL(page.url()).origin + "/"),
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
  // The course is untouched and still local.
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})
