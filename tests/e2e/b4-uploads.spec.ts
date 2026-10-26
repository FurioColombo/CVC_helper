import { expect, type Page, test } from "@playwright/test"

/**
 * B4's uploads with a fake backend (no network leaves the test): the
 * switch's course goes up in batches carrying the app version; a change the
 * server refuses is kept and listed in Impostazioni while the rest goes
 * through, and "Riprova l’invio" sends it again; an app below the server's
 * minimum writer is told to update. Synthetic people only.
 */
const fakeBackend = "https://backup.fake.test"
const authKey = "cvc-helper.backup-auth"
const account = {
  id: "b4b4b4b4-e5f6-4a7b-8c9d-0123456789ab",
  aud: "authenticated",
  role: "authenticated",
  email: "istruttore@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-01T00:00:00Z",
}
const session = {
  access_token: "fake-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh-token",
  user: account,
}

type Write = {
  table: string
  method: string
  version: string | null
  rows: Array<Record<string, unknown>>
}

/**
 * The fake answers each write with `answer(write)`; by default it accepts.
 * The account holds no course yet, and the sync service is out of reach.
 */
async function withBackend(
  page: Page,
  answer: (write: Write) => { status: number; code?: string } = () => ({
    status: 201,
  }),
) {
  const writes: Write[] = []
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
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    if (url.pathname === "/rest/v1/courses" && request.method() === "GET")
      return json([])
    if (!url.pathname.startsWith("/rest/v1/")) return json({})
    const body = request.postDataJSON() as unknown
    const write: Write = {
      table: url.pathname.slice("/rest/v1/".length),
      method: request.method(),
      version: request.headers()["x-cvc-app-version"] ?? null,
      rows: Array.isArray(body) ? body : body ? [body as never] : [],
    }
    writes.push(write)
    const { status, code } = answer(write)
    return status < 300
      ? route.fulfill({ status, body: "" })
      : json({ code, message: "refused" }, status)
  })
  return writes
}

async function courseWithStudents(page: Page, names: string[]) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  for (const name of names) {
    await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
    await page.getByLabel("Nome", { exact: true }).fill(name)
    await page.getByLabel("Cognome", { exact: true }).fill("Sintetico")
    await page
      .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
      .fill("15")
    await page.getByRole("radio", { name: "Altro" }).check()
    await page.getByRole("button", { name: "Salva allievo" }).click()
    await expect(
      page.getByRole("button", {
        name: new RegExp(`Sintetico ${name}|${name}`),
      }),
    ).toBeVisible()
  }
}

/** Signs in as at the end of a link and lets the device switch and reopen. */
async function signIn(page: Page) {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [authKey, session] as const,
  )
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
}

async function backupSection(page: Page) {
  // The reopened app is back on the screen it showed: Allievi.
  const settings = page.getByRole("button", { name: "Impostazioni" })
  const home = page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
  await expect(settings.or(home).first()).toBeVisible()
  if (!(await settings.isVisible())) await home.click()
  await settings.click()
  return page.getByRole("region", { name: "Backup online" })
}

const hasStudent = (write: Write, name: string) =>
  write.table === "students" && write.rows.some((row) => row.firstName === name)

test("the switch uploads the course in batches, each write naming the app version", async ({
  page,
}) => {
  const writes = await withBackend(page)
  await courseWithStudents(page, ["Ada", "Eva", "Ida"])
  await signIn(page)
  const section = await backupSection(page)
  await expect(section).toContainText("Accesso: istruttore@example.test")

  await expect
    .poll(() => writes.filter(({ table }) => table === "students").length)
    .toBeGreaterThan(0)
  // Parents first, the students in one request, every write with a version.
  expect(writes[0]?.table).toBe("courses")
  const students = writes.filter(({ table }) => table === "students")
  expect(students).toHaveLength(1)
  expect(students[0]!.rows.map((row) => row.firstName).sort()).toEqual([
    "Ada",
    "Eva",
    "Ida",
  ])
  expect(
    writes.every(({ version }) => /^\d+\.\d+\.\d+$/.test(version ?? "")),
  ).toBe(true)
})

test("a refused change is kept and listed, the rest goes through, and Riprova sends it again", async ({
  page,
}) => {
  let refuseEva = true
  const writes = await withBackend(page, (write) =>
    refuseEva && hasStudent(write, "Eva")
      ? { status: 400, code: "23502" }
      : { status: 201 },
  )
  await courseWithStudents(page, ["Ada", "Eva"])
  await signIn(page)
  const section = await backupSection(page)

  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica: restano su questo telefono.",
    { timeout: 30_000 },
  )
  await expect(section.getByRole("alert")).toContainText(
    "Contengono dati che il backup non accetta.",
  )
  // The fake sync service is out of reach, so the line says offline; it
  // never claims everything was sent.
  await expect(section.getByRole("status")).not.toContainText("Tutto inviato")
  // Ada went up alone after the batch was refused; Eva stays on the phone.
  expect(
    writes.some(
      (write) => hasStudent(write, "Ada") && !hasStudent(write, "Eva"),
    ),
  ).toBe(true)

  refuseEva = false
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect(section.getByRole("alert")).toHaveCount(0, { timeout: 30_000 })
  await expect(section.getByRole("status")).toContainText("Tutto inviato")
  expect(
    writes.filter((write) => hasStudent(write, "Eva")).at(-1)?.method,
  ).toBeDefined()
})

test("an app below the server's minimum writer is told to update and keeps its changes", async ({
  page,
}) => {
  await withBackend(page, () => ({ status: 400, code: "CVOLD" }))
  await courseWithStudents(page, ["Ada"])
  await signIn(page)
  const section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Aggiorna l’app: intanto le modifiche restano su questo telefono.",
    { timeout: 30_000 },
  )
  await expect(section.getByRole("status")).toContainText("da inviare")
})
