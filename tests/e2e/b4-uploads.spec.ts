import { createServer, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"

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
type Row = Record<string, unknown> & { id: string; updatedAt?: string }

/**
 * A fake backend with the server's upload rules
 * (supabase/migrations/20261026000000_upload_rules.sql): it stores the rows,
 * an insert replaces a row whole, an update or a delete older than the row
 * is skipped, and every write answers with the rows it changed. `answer`
 * refuses a write before it applies; by default nothing is refused. The
 * sync service is out of reach.
 */
async function withBackend(
  page: Page,
  answer: (
    write: Write,
  ) => { status: number; code?: string } | "unreachable" | null = () => null,
  { powersyncUrl = "https://sync.fake.test" } = {},
) {
  const writes: Write[] = []
  const server = new Map<string, Map<string, Row>>()
  const table = (name: string) => {
    if (!server.has(name)) server.set(name, new Map())
    return server.get(name)!
  }
  await page.addInitScript(
    ([url, sync]) => {
      window.__cvcBackupConfig = {
        supabaseUrl: url,
        supabaseKey: "sb_publishable_fake",
        powersyncUrl: sync,
      }
    },
    [fakeBackend, powersyncUrl] as const,
  )
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
    if (!url.pathname.startsWith("/rest/v1/")) return json({})
    const rows = table(url.pathname.slice("/rest/v1/".length))
    const id = url.searchParams.get("id")?.replace(/^eq\./, "")
    if (request.method() === "GET")
      return json(
        [...rows.values()]
          .filter((row) => !id || row.id === id)
          .map((row) => ({ id: row.id })),
      )
    const body = request.postDataJSON() as unknown
    const write: Write = {
      table: url.pathname.slice("/rest/v1/".length),
      method: request.method(),
      version: request.headers()["x-cvc-app-version"] ?? null,
      rows: Array.isArray(body) ? body : body ? [body as never] : [],
    }
    writes.push(write)
    const refusal = answer(write)
    if (refusal === "unreachable") return route.abort()
    if (refusal)
      return json({ code: refusal.code, message: "refused" }, refusal.status)
    const older = (next: unknown, stored: Row | undefined) =>
      typeof next === "string" &&
      typeof stored?.updatedAt === "string" &&
      next < stored.updatedAt
    const changed: Row[] = []
    if (request.method() === "POST")
      for (const row of write.rows as Row[]) {
        if (older(row.updatedAt, rows.get(row.id))) continue
        rows.set(row.id, row)
        changed.push(row)
      }
    else if (request.method() === "PATCH" && id) {
      const stored = rows.get(id)
      const patch = write.rows[0] ?? {}
      if (stored && !older(patch.updatedAt, stored)) {
        rows.set(id, { ...stored, ...patch })
        changed.push(stored)
      }
    } else if (request.method() === "DELETE" && id) {
      const stored = rows.get(id)
      const seen = url.searchParams.get("updatedAt")?.replace(/^lte\./, "")
      if (stored && !(seen && older(seen, stored))) {
        rows.delete(id)
        changed.push(stored)
      }
    }
    return json(
      changed.map((row) => ({ id: row.id })),
      request.method() === "POST" ? 201 : 200,
    )
  })
  return { writes, server: table }
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
  const { writes } = await withBackend(page)
  await courseWithStudents(page, ["Ada", "Eva", "Ida"])
  await signIn(page)
  const section = await backupSection(page)
  await expect(section).toContainText("Accesso: istruttore@example.test")

  await expect
    .poll(() => writes.filter(({ table }) => table === "students").length)
    .toBeGreaterThan(0)
  // Parents first, the students in one request, every write with a version.
  // B6: before them, the switch's course may lift an erased-id record, and
  // the minimum writer is read (an RPC, no course data).
  expect(
    writes.find(
      ({ table }) => table !== "erased_courses" && !table.startsWith("rpc/"),
    )?.table,
  ).toBe("courses")
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
  const { writes } = await withBackend(page, (write) =>
    refuseEva && hasStudent(write, "Eva")
      ? { status: 400, code: "23502" }
      : null,
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
  // It never claims everything was sent while a change is refused.
  await expect(section.getByRole("status")).toContainText(
    "Copia online aggiornata, tranne 1 modifica rifiutata.",
  )
  // Ada went up alone after the batch was refused; Eva stays on the phone.
  expect(
    writes.some(
      (write) => hasStudent(write, "Ada") && !hasStudent(write, "Eva"),
    ),
  ).toBe(true)

  refuseEva = false
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect(section.getByRole("alert")).toHaveCount(0, { timeout: 30_000 })
  // The fake sync service stays out of reach, as the download stream did on
  // the owner's phone after a day offline: every change sent, the line says
  // so (owner check B4-PHONE-UPLOADS, 2026-10-28).
  await expect(section.getByRole("status")).toContainText(
    "Copia online aggiornata.",
  )
  await expect(section.getByRole("status")).not.toContainText(
    "senza connessione",
  )
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

async function openStudent(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: new RegExp(`^${name},`) }).click()
}

async function editAge(page: Page, name: string, age: string) {
  await openStudent(page, name)
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel("Età compiuta il primo giorno del corso").fill(age)
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByText(`${age} anni · dichiarata`)).toBeVisible()
}

/** The server's copy of the student called `name`, if any. */
const serverStudent = (
  server: (name: string) => Map<string, Row>,
  name: string,
) => [...server("students").values()].find((row) => row.firstName === name)

// Reviews SC-B4-1, DI-B4-2: Riprova sends the change as the row now stands;
// an edit made after the refusal is not lost, nor overwritten.
test("Riprova sends a refused student with the edit made after the refusal", async ({
  page,
}) => {
  let refuseEva = true
  const { server } = await withBackend(page, (write) =>
    refuseEva &&
    write.table === "students" &&
    write.method === "POST" &&
    write.rows.some((row) => row.firstName === "Eva")
      ? { status: 400, code: "23514" }
      : null,
  )
  await courseWithStudents(page, ["Ada", "Eva"])
  await signIn(page)
  let section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica",
    { timeout: 30_000 },
  )
  // Edited after the refusal: the server has no Eva, so the edit is kept too.
  await editAge(page, "Eva", "16")
  section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 2 modifiche",
    { timeout: 30_000 },
  )
  refuseEva = false
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect(section.getByRole("alert")).toHaveCount(0, { timeout: 30_000 })
  await expect
    .poll(() => serverStudent(server, "Eva")?.declaredAgeAtCourseStart, {
      timeout: 30_000,
    })
    .toBe(16)
})

test("a student deleted after a refusal stays deleted and leaves the list", async ({
  page,
}) => {
  const { server } = await withBackend(page, (write) =>
    write.table === "students" &&
    write.method === "POST" &&
    write.rows.some((row) => row.firstName === "Eva")
      ? { status: 400, code: "23514" }
      : null,
  )
  await courseWithStudents(page, ["Ada", "Eva"])
  await signIn(page)
  let section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica",
    { timeout: 30_000 },
  )
  await openStudent(page, "Eva")
  await page
    .getByRole("button", { name: "Disponibilità ed eliminazione" })
    .click()
  await page.getByRole("button", { name: "Elimina definitivamente" }).click()
  await page.getByRole("button", { name: "Conferma" }).click()
  section = await backupSection(page)
  // Its delete cancels the refusal as it uploads; nothing to send again.
  await expect(section.getByRole("alert")).toHaveCount(0, { timeout: 30_000 })
  expect(serverStudent(server, "Eva")).toBeUndefined()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Eva,/ })).toHaveCount(0)
})

test("a refused edit is sent whole on Riprova, never as an empty change", async ({
  page,
}) => {
  let refuseEdits = false
  // An edit goes as the whole row, an insert that replaces it.
  const { writes, server } = await withBackend(page, (write) =>
    refuseEdits && hasStudent(write, "Eva")
      ? { status: 400, code: "23514" }
      : null,
  )
  await courseWithStudents(page, ["Ada", "Eva"])
  await signIn(page)
  await expect.poll(() => serverStudent(server, "Eva")?.firstName).toBe("Eva")
  refuseEdits = true
  await editAge(page, "Eva", "16")
  const section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica",
    { timeout: 30_000 },
  )
  refuseEdits = false
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect(section.getByRole("alert")).toHaveCount(0, { timeout: 30_000 })
  await expect
    .poll(() => serverStudent(server, "Eva")?.declaredAgeAtCourseStart)
    .toBe(16)
  expect(
    writes.some(
      (write) =>
        write.method === "PATCH" &&
        write.rows.every((row) => Object.keys(row).length === 0),
    ),
  ).toBe(false)
})

test("refusals that cannot be sent can be taken off the list, the course unchanged", async ({
  page,
}) => {
  await withBackend(page, (write) =>
    write.table === "students" ? { status: 400, code: "23514" } : null,
  )
  await courseWithStudents(page, ["Ada"])
  await signIn(page)
  const section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica",
    { timeout: 30_000 },
  )
  await section.getByRole("button", { name: "Togli dall’elenco" }).click()
  await expect(section.getByRole("alert")).toContainText(
    "Le modifiche tolte non arriveranno alla copia online.",
  )
  await section.getByRole("button", { name: "Togli", exact: true }).click()
  await expect(section.getByRole("alert")).toHaveCount(0)
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Ada,/ })).toBeVisible()
})

// Review SP-B4-1: a refusal that arrives after its course was erased holds
// the erased people's data; it is not kept, and nothing can bring them back.
// B6: the erase forgets the queue, so the held upload is never even sent.
test("a refusal arriving after the course was erased is not kept", async ({
  page,
}) => {
  let reachable = false
  const { writes } = await withBackend(page, (write) =>
    !reachable
      ? "unreachable"
      : hasStudent(write, "Ottavia")
        ? { status: 403, code: "42501" }
        : null,
  )
  await courseWithStudents(page, ["Ottavia"])
  await signIn(page)
  // The switch's own reopen comes after the sign-in's: tap only once the
  // backup shows the account, or the reopen wipes the question.
  await expect(await backupSection(page)).toContainText(
    "Accesso: istruttore@example.test",
  )
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  reachable = true
  const sentBefore = writes.length
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  const section = await backupSection(page)
  // The pending server erase completes at the next connection attempt.
  const retry = section.getByRole("button", { name: "Riprova", exact: true })
  await expect(async () => {
    if (await retry.isVisible()) await retry.click()
    await expect(section).toContainText("Accesso: istruttore@example.test", {
      timeout: 2_000,
    })
  }).toPass({ timeout: 30_000 })
  // Long enough for any held upload to be sent and refused.
  await page.waitForTimeout(8_000)
  await expect(section.getByText("Il backup ha rifiutato")).toHaveCount(0)
  const kept = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { uploadRefusals } = (await load(
      "/src/persistence/backupLink.ts",
    )) as { uploadRefusals: () => Promise<Array<{ data: unknown }>> }
    return JSON.stringify(await uploadRefusals())
  })
  expect(kept).not.toContain("Ottavia")
  expect(
    writes.slice(sentBefore).filter((write) => hasStudent(write, "Ottavia")),
  ).toEqual([])
})

// Review DI-B4-3, round 2: a delete still waiting to upload wins over
// Riprova; the student is not brought back.
test("Riprova does not bring back a student whose delete has not uploaded yet", async ({
  page,
}) => {
  let mode: "refusing" | "unreachable" = "refusing"
  const { server } = await withBackend(page, (write) =>
    mode === "unreachable"
      ? "unreachable"
      : write.table === "students" &&
          write.rows.some((row) => row.firstName === "Eva")
        ? { status: 400, code: "23514" }
        : null,
  )
  await courseWithStudents(page, ["Ada", "Eva"])
  await signIn(page)
  let section = await backupSection(page)
  await expect(section.getByRole("alert")).toContainText(
    "Il backup ha rifiutato 1 modifica",
    { timeout: 30_000 },
  )
  mode = "unreachable"
  await openStudent(page, "Eva")
  await page
    .getByRole("button", { name: "Disponibilità ed eliminazione" })
    .click()
  await page.getByRole("button", { name: "Elimina definitivamente" }).click()
  await page.getByRole("button", { name: "Conferma" }).click()
  section = await backupSection(page)
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect(section.getByRole("alert")).toContainText(
    "1 modifica non si può reinviare da qui.",
  )
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Eva,/ })).toHaveCount(0)
  expect(serverStudent(server, "Eva")).toBeUndefined()
})

// Owner check B4-PHONE-UPLOADS (2026-10-28): after a day offline the phone
// sent every change while its download stream stayed down until the app
// reopened. A stream request that hangs on a dead connection is restarted
// while the app is online and on screen; the status line follows the
// uploads meanwhile. The sync service here is a local server whose stream
// request is accepted and never answered, as on a dead connection.
test("a download stream hung on a dead connection is restarted, and the status follows the uploads", async ({
  page,
}) => {
  test.setTimeout(150_000)
  let streamRequests = 0
  const hung: ServerResponse[] = []
  const server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", "*")
    response.setHeader("access-control-allow-headers", "*")
    response.setHeader("access-control-allow-methods", "GET, POST")
    if (request.method === "OPTIONS") return response.writeHead(204).end()
    // Only the stream hangs; a write checkpoint answers, as it did on the
    // phone, where every change was sent.
    if (request.url?.includes("write-checkpoint"))
      return response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ data: { write_checkpoint: "1" } }))
    streamRequests += 1
    hung.push(response)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  try {
    const { writes } = await withBackend(page, () => null, {
      powersyncUrl: `http://127.0.0.1:${port}`,
    })
    await courseWithStudents(page, ["Ada"])
    await signIn(page)
    await expect
      .poll(() => writes.filter(({ table }) => table === "students").length, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0)
    const section = await backupSection(page)
    await expect(section.getByRole("status")).toContainText(
      "Copia online aggiornata.",
    )
    const before = streamRequests
    expect(before).toBeGreaterThan(0)
    // PowerSync waits on a hung request for ever; the app restarts it.
    await expect
      .poll(() => streamRequests, { timeout: 60_000, intervals: [2_000] })
      .toBeGreaterThan(before)
    await expect(section.getByRole("status")).toContainText(
      "Copia online aggiornata.",
    )
  } finally {
    for (const response of hung) response.destroy()
    server.close()
  }
})
