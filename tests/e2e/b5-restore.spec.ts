import { expect, type Page, test } from "@playwright/test"

/**
 * B5's screens with a fake backend (no network leaves the test): the
 * account holds a course online and the sync service is out of reach, so a
 * restore waits. An empty device offers the restore and creates nothing while
 * it runs; a device holding another course asks before it is replaced, and
 * cancelling keeps it. Synthetic people only.
 */
const fakeBackend = "https://backup.fake.test"
const authKey = "cvc-helper.backup-auth"
const session = {
  access_token: "fake-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh-token",
  user: {
    id: "b5b5b5b5-e5f6-4a7b-8c9d-0123456789ab",
    aud: "authenticated",
    role: "authenticated",
    email: "istruttore@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-01T00:00:00Z",
  },
}

async function withAccountCourse(page: Page) {
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
    const url = new URL(request.url())
    const json = (body: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 })
    if (url.pathname === "/rest/v1/courses" && request.method() === "GET")
      return json([{ id: "online-course", label: "D3 45 2026" }])
    return json([])
  })
}

async function signIn(page: Page) {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [authKey, session] as const,
  )
}

test("an empty device offers the restore and creates nothing while it runs", async ({
  page,
}) => {
  await withAccountCourse(page)
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  const restore = page.getByRole("region", {
    name: "Ripristina dal backup online",
  })
  await expect(restore).toContainText(
    "Hai già un corso nel backup online? Accedi con la tua email per ripristinarlo",
  )
  await signIn(page)
  // As after the emailed link: the app opens, switches and reopens.
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
  await expect(restore).toContainText(
    "Ripristino del corso dal backup online…",
    {
      timeout: 30_000,
    },
  )
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await expect(page.getByRole("button", { name: "Crea corso" })).toBeDisabled()
  await expect(
    page.getByText("per crearne uno nuovo attendi la fine"),
  ).toBeVisible()
})

async function courseHere(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
}

test("a device holding another course asks first, and Annulla keeps it", async ({
  page,
}) => {
  await withAccountCourse(page)
  await courseHere(page)
  await signIn(page)
  await page.reload()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const section = page.getByRole("region", { name: "Backup online" })
  const question = section.getByRole("alertdialog")
  await expect(question).toContainText(
    "Questo account ha già un corso online: D3 45 2026",
  )
  await expect(question).toContainText("esportalo prima")
  await expect(
    question.getByRole("button", { name: "Sostituisci con il corso online" }),
  ).toBeDisabled()
  await question.getByRole("button", { name: "Annulla ed esci" }).click()
  await expect(section.getByLabel("Email")).toBeVisible()
  await page.getByRole("button", { name: "Torna alla Home" }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
})

test("replacing erases this device's course, merges nothing, and restores", async ({
  page,
}) => {
  await withAccountCourse(page)
  await courseHere(page)
  await signIn(page)
  await page.reload()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const question = page
    .getByRole("region", { name: "Backup online" })
    .getByRole("alertdialog")
  await question
    .getByRole("checkbox", {
      name: "Ho capito: il corso di questo telefono sarà eliminato",
    })
    .check()
  const reopened = page.waitForEvent("load")
  await question
    .getByRole("button", { name: "Sostituisci con il corso online" })
    .click()
  await reopened
  // The device's own course is gone; the online one is on its way.
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Ripristina dal backup online" }),
  ).toContainText("Ripristino del corso dal backup online…", {
    timeout: 30_000,
  })
})
