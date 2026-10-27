import { expect, type Page, test } from "@playwright/test"

/**
 * B6's erase with a fake backend (no network leaves the test) that keeps
 * the server's rules: a course's rows go with it, an erased course id
 * refuses its course row (SQLSTATE CVERA), and every write answers with the
 * rows it changed. Erasing the course, replacing it with a course file and
 * the full reset take it off the server too; offline, nothing of it stays
 * on the device and the server's erase completes with signal.
 * Synthetic people only.
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
    id: "b6b6b6b6-e5f6-4a7b-8c9d-0123456789ab",
    aud: "authenticated",
    role: "authenticated",
    email: "istruttore@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-01T00:00:00Z",
  },
}

type Row = Record<string, unknown> & { id: string; courseId?: string }
type Write = {
  table: string
  method: string
  ids: string[]
  version: string | null
}

/** `id=eq.x` or `id=in.(x,y)`, as PostgREST writes them. */
function idsOf(filter: string | null) {
  if (!filter) return []
  if (filter.startsWith("eq.")) return [filter.slice(3)]
  const list = /^in\.\((.*)\)$/.exec(filter)?.[1] ?? ""
  return list
    .split(",")
    .map((id) => id.replace(/^"|"$/g, ""))
    .filter(Boolean)
}

async function withBackend(page: Page, { installed = true } = {}) {
  const writes: Write[] = []
  const server = new Map<string, Map<string, Row>>()
  const table = (name: string) => {
    if (!server.has(name)) server.set(name, new Map())
    return server.get(name)!
  }
  const state = { reachable: true, liftRefused: false }
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
    if (!url.pathname.startsWith("/rest/v1/")) return json({})
    if (!state.reachable) return route.abort()
    const name = url.pathname.slice("/rest/v1/".length)
    if (name === "erased_courses" && !installed)
      return json({ code: "PGRST205", message: "not found" }, 404)
    if (
      name === "erased_courses" &&
      request.method() === "DELETE" &&
      state.liftRefused
    )
      return json({ message: "unavailable" }, 503)
    const rows = table(name)
    const ids = idsOf(url.searchParams.get("id"))
    if (request.method() === "GET")
      return json(
        [...rows.values()]
          .filter((row) => !ids.length || ids.includes(row.id))
          .map((row) => ({ id: row.id, label: row.label })),
      )
    const body = request.postDataJSON() as unknown
    const posted = (Array.isArray(body) ? body : body ? [body] : []) as Row[]
    writes.push({
      table: name,
      method: request.method(),
      ids: request.method() === "POST" ? posted.map(({ id }) => id) : ids,
      version: request.headers()["x-cvc-app-version"] ?? null,
    })
    const changed: Row[] = []
    if (request.method() === "POST") {
      if (
        name === "courses" &&
        posted.some(({ id }) => table("erased_courses").has(id))
      )
        return json({ code: "CVERA", message: "erased" }, 400)
      for (const row of posted) {
        rows.set(row.id, row)
        changed.push(row)
      }
    } else if (request.method() === "DELETE") {
      for (const id of ids) {
        const stored = rows.get(id)
        if (!stored) continue
        rows.delete(id)
        changed.push(stored)
        // The course's rows go with it (20261025000000_hardening.sql).
        if (name === "courses")
          for (const [child, childRows] of server)
            if (child !== "courses" && child !== "erased_courses")
              for (const [rowId, row] of childRows)
                if (row.courseId === id) childRows.delete(rowId)
      }
    }
    return json(
      changed.map((row) => ({ id: row.id })),
      request.method() === "POST" ? 201 : 200,
    )
  })
  return { writes, table, state }
}

type Backend = Awaited<ReturnType<typeof withBackend>>

async function courseWithStudent(page: Page, name: string) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await addStudent(page, name)
}

async function addStudent(page: Page, name: string) {
  const home = page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
  await home.click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(name)
  await page.getByLabel("Cognome", { exact: true }).fill("Sintetico")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(name) }).first(),
  ).toBeVisible()
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

async function settings(page: Page) {
  const button = page.getByRole("button", { name: "Impostazioni" })
  const home = page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
  await expect(button.or(home).first()).toBeVisible()
  if (!(await button.isVisible())) await home.click()
  await button.click()
}

/** What the device still holds, read from its database. */
function stored(page: Page, names: string[]) {
  return page.evaluate(async (names) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    const count = async (sql: string) =>
      (await db.getAll<{ n: number }>(sql))[0]?.n ?? -1
    const texts = [
      ...(await db.getAll<{ t: string | null }>(
        "SELECT data AS t FROM ps_crud",
      )),
      ...(await db.getAll<{ t: string | null }>(
        "SELECT data AS t FROM ps_oplog",
      )),
      ...(await db.getAll<{ t: string | null }>(
        "SELECT data AS t FROM ps_untyped",
      )),
      ...(await db.getAll<{ t: string | null }>(
        "SELECT data AS t FROM uploadRefusals",
      )),
      ...(await db.getAll<{ t: string | null }>(
        "SELECT firstName AS t FROM students",
      )),
    ].map(({ t }) => t ?? "")
    return {
      queue: await count("SELECT count(*) AS n FROM ps_crud"),
      erasures: await db.getAll<{ id: string; erase: number; keep: number }>(
        "SELECT id, erase, keep FROM serverErasures",
      ),
      found: names.filter((name) => texts.some((text) => text.includes(name))),
    }
  }, names)
}

/** After the switch and its reopen, the course is on the server. */
async function waitUntilSent(page: Page, backend: Backend) {
  await expect
    .poll(() => backend.table("students").size, { timeout: 30_000 })
    .toBe(1)
  await expect
    .poll(async () => (await stored(page, [])).queue, { timeout: 30_000 })
    .toBe(0)
}

async function eraseCourse(page: Page) {
  await settings(page)
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  await expect(
    page.getByText("e dal backup online, appena c’è connessione"),
  ).toBeVisible()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  const reopened = page.waitForEvent("load")
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await reopened
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
}

test("an erase takes the course off the server and leaves nothing of it here", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)
  const [courseId] = [...backend.table("courses").keys()]

  await eraseCourse(page)

  await expect.poll(() => backend.table("courses").size).toBe(0)
  // Every row of the course went with it, and its id is recorded.
  expect(backend.table("students").size).toBe(0)
  expect([...backend.table("erased_courses").keys()]).toEqual([courseId])
  const erase = backend.writes.find(
    (write) => write.table === "courses" && write.method === "DELETE",
  )!
  expect(erase.ids).toEqual([courseId])
  // Unconditional (no updatedAt filter), with the app version (B4).
  expect(erase.version).toMatch(/^\d+\.\d+\.\d+$/)
  await expect.poll(async () => (await stored(page, [])).erasures).toEqual([])
  expect(await stored(page, ["Ginevra"])).toMatchObject({
    queue: 0,
    found: [],
  })
})

test("offline, an erase leaves nothing here, unsent changes included, and completes with signal", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)
  const [courseId] = [...backend.table("courses").keys()]

  backend.state.reachable = false
  // A change that never left the phone: its row waits in the queue.
  await addStudent(page, "Ottavia")
  expect((await stored(page, ["Ottavia"])).found).toContain("Ottavia")

  await eraseCourse(page)

  expect(await stored(page, ["Ginevra", "Ottavia"])).toMatchObject({
    queue: 0,
    erasures: [{ id: courseId, erase: 1, keep: 0 }],
    found: [],
  })
  expect(backend.table("courses").size).toBe(1)
  // A new course made meanwhile waits too, and goes up after the erase.
  // Impostazioni says the erase is still to make, and Esci warns that only
  // this account on this phone can finish it (review SP-B6-2).
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  await settings(page)
  const section = page.getByRole("region", { name: "Backup online" })
  // The phone offline: the backup waits, saying what is still to erase.
  await page.context().setOffline(true)
  await section.getByRole("button", { name: "Riprova", exact: true }).click()
  await expect(section).toContainText(
    "il corso eliminato qui è ancora nel backup online",
  )
  await section.getByRole("button", { name: "Esci", exact: true }).click()
  await expect(section.getByRole("alertdialog")).toContainText(
    "sarà tolto solo quando rientri con questo account da questo telefono",
  )
  await section.getByRole("button", { name: "Resta collegato" }).click()

  // Signal back: the erase completes by itself.
  backend.state.reachable = true
  await page.context().setOffline(false)
  await expect(section).toContainText("Accesso: istruttore@example.test")
  await expect.poll(() => backend.table("erased_courses").size).toBe(1)
  await expect
    .poll(() => [...backend.table("courses").keys()])
    .not.toContain(courseId)
  await expect.poll(() => backend.table("courses").size).toBe(1)
  const order = backend.writes
    .filter((write) => write.table === "courses")
    .map((write) => write.method)
  expect(order.slice(-2)).toEqual(["DELETE", "POST"])
  expect((await stored(page, [])).erasures).toEqual([])
})

test("a course file of the same course replaces it on the server, accepted again", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)
  const [courseId] = [...backend.table("courses").keys()]
  // An earlier erase of this id, then the owner imports its file.
  backend.table("erased_courses").set(courseId!, { id: courseId! })
  backend.writes.length = 0

  // Setup through the import itself; the server's part is the app's.
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { exportCourseArchive, importCourseArchive } = (await load(
      "/src/persistence/courseArchive.ts",
    )) as typeof import("../../src/persistence/courseArchive")
    await importCourseArchive(await exportCourseArchive())
  })
  expect((await stored(page, [])).erasures).toEqual([
    { id: courseId, erase: 1, keep: 1 },
  ])
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened

  await expect
    .poll(
      () =>
        backend.writes.filter(
          (write) => write.table === "courses" && write.method === "POST",
        ).length,
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0)
  // The old rows erased, the id accepted again, then the file's course up;
  // no record of an erase is left for this id.
  expect(
    backend.writes.slice(0, 3).map((write) => `${write.method} ${write.table}`),
  ).toEqual(["DELETE courses", "DELETE erased_courses", "POST courses"])
  expect(backend.table("erased_courses").size).toBe(0)
  await expect.poll(() => backend.table("students").size).toBe(1)
})

test("a full reset erases the backup's copy first; without signal it resets nothing", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)

  backend.state.reachable = false
  await settings(page)
  await page.getByRole("button", { name: "Azzera tutti i dati locali" }).click()
  await expect(
    page.getByText("Il corso sarà eliminato anche dal backup online"),
  ).toBeVisible()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: corso, preferenze e file offline saranno cancellati",
    })
    .check()
  await page.getByRole("button", { name: "Azzera i dati" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "Il corso non è stato eliminato dal backup online, quindi nulla è stato azzerato.",
  )
  expect((await stored(page, ["Ginevra"])).found).toEqual(["Ginevra"])

  backend.state.reachable = true
  await page.getByRole("button", { name: "Azzera i dati" }).click()
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible({ timeout: 30_000 })
  expect(backend.table("courses").size).toBe(0)
  expect(backend.table("students").size).toBe(0)
})

test("before the server records erased ids, the erase still deletes the course", async ({
  page,
}) => {
  const backend = await withBackend(page, { installed: false })
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)

  await eraseCourse(page)

  await expect.poll(() => backend.table("courses").size).toBe(0)
  expect(backend.table("students").size).toBe(0)
  // Forgotten all the same: a repeated delete could erase a later import
  // of the course (review DI-B6-R2-1).
  await expect.poll(async () => (await stored(page, [])).erasures).toEqual([])
})

// Review DI-B6-R2-1: before the server records erased ids, an erase is not
// repeated at later connections, so a later import of the course elsewhere
// stays.
test("an erase made before the server records erased ids is not repeated later", async ({
  page,
}) => {
  const backend = await withBackend(page, { installed: false })
  await courseWithStudent(page, "Ginevra")
  await signIn(page)
  await waitUntilSent(page, backend)
  const course = [...backend.table("courses").values()][0]!
  const student = [...backend.table("students").values()][0]!

  await eraseCourse(page)
  await expect.poll(() => backend.table("courses").size).toBe(0)

  // Another phone imports the course's file and uploads it again.
  backend.table("courses").set(course.id, course)
  backend.table("students").set(student.id, student)
  backend.writes.length = 0
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
  await page.waitForTimeout(5_000)
  expect(backend.writes.filter((write) => write.method === "DELETE")).toEqual(
    [],
  )
  expect(backend.table("courses").size).toBe(1)
  expect(backend.table("students").size).toBe(1)
})

// Review DI-B6-R2-2: a phone that never used the backup brings in a course
// whose id was erased on another phone (its file imported here): signing in
// is the owner's choice, so the id is accepted again before the upload.
test("signing in with a course whose id was erased elsewhere uploads it, accepted again", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  const courseId = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { deviceCourseId } = (await load(
      "/src/persistence/backupLink.ts",
    )) as typeof import("../../src/persistence/backupLink")
    return deviceCourseId()
  })
  backend.table("erased_courses").set(courseId!, { id: courseId! })

  await signIn(page)
  await waitUntilSent(page, backend)

  expect(backend.table("erased_courses").size).toBe(0)
  expect([...backend.table("courses").keys()]).toEqual([courseId])
  const order = backend.writes.map((write) => `${write.method} ${write.table}`)
  expect(order.indexOf("DELETE erased_courses")).toBeLessThan(
    order.indexOf("POST courses"),
  )
  expect((await stored(page, ["Ginevra"])).found).toEqual(["Ginevra"])
})

// A course accepted again never holds the backup back: refused once, the
// acceptance is asked again at the next connection, and the course's refused
// upload is kept for Riprova meanwhile, not dropped.
test("accepting an erased id again waits for the server without holding the backup back", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await courseWithStudent(page, "Ginevra")
  const courseId = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { deviceCourseId } = (await load(
      "/src/persistence/backupLink.ts",
    )) as typeof import("../../src/persistence/backupLink")
    return deviceCourseId()
  })
  backend.table("erased_courses").set(courseId!, { id: courseId! })
  backend.state.liftRefused = true

  await signIn(page)
  await settings(page)
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section).toContainText("Accesso: istruttore@example.test")
  await expect(section.getByRole("alert")).toContainText(
    "Riguardano un corso eliminato dal backup online da un altro telefono.",
    { timeout: 30_000 },
  )
  expect(await stored(page, [])).toMatchObject({
    erasures: [{ id: courseId, erase: 0, keep: 1 }],
  })

  backend.state.liftRefused = false
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
  await expect.poll(() => backend.table("erased_courses").size).toBe(0)
  await settings(page)
  await section.getByRole("button", { name: "Riprova l’invio" }).click()
  await expect.poll(() => backend.table("courses").size).toBe(1)
  await expect.poll(() => backend.table("students").size).toBe(1)
  expect((await stored(page, [])).erasures).toEqual([])
})
