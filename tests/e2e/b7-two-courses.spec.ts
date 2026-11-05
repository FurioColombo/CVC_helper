import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * B7: an account holding several courses never locks a device. A fake backend
 * (no network leaves the test) keeps the server's rule: `keep_course` erases
 * what the app named, refuses a course already gone (CVGON) and refuses
 * whatever the app did not see (CVNEW).
 * The fake has no sync stream, so `downloadRemoves` does what the download does
 * after the server's answer; the real one is in b7-two-courses-live.spec.ts.
 * Synthetic people only.
 */
const fakeBackend = "https://backup.fake.test"
const authKey = "cvc-helper.backup-auth"
const email = "istruttore@example.test"
const session = {
  access_token: "fake-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh-token",
  user: {
    id: "b7b7b7b7-e5f6-4a7b-8c9d-0123456789ab",
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-01T00:00:00Z",
  },
}

type Row = Record<string, unknown> & { id: string; courseId?: string }

async function withBackend(page: Page) {
  const server = new Map<string, Map<string, Row>>()
  const table = (name: string) => {
    if (!server.has(name)) server.set(name, new Map())
    return server.get(name)!
  }
  const state = {
    keepAnswer: "server" as
      "server" | "unavailable" | "refused" | "lost" | "hang",
    release: null as null | (() => void),
    held: null as null | Promise<void>,
    keeps: [] as Array<{ keep: string; queuedRows: number }>,
  }
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
    const name = url.pathname.slice("/rest/v1/".length)
    if (name === "rpc/keep_course") {
      if (state.keepAnswer === "unavailable")
        return json({ message: "unavailable" }, 503)
      if (state.keepAnswer === "refused")
        return json({ code: "42501", message: "refused" }, 403)
      if (state.keepAnswer === "hang") return
      const { keep_id: keep, give_up: giveUp } = request.postDataJSON() as {
        keep_id: string
        give_up: Record<string, string>
      }
      state.keeps.push({ keep, queuedRows: table("students").size })
      if (!table("courses").has(keep))
        return json({ code: "CVGON", message: "gone" }, 400)
      const others = [...table("courses").keys()].filter((id) => id !== keep)
      const fingerprint = (id: string) =>
        createHash("sha256")
          .update(
            [...server]
              .flatMap(([name, rows]) =>
                [...rows.values()]
                  .filter((row) =>
                    name === "courses" ? row.id === id : row.courseId === id,
                  )
                  .map(
                    (row) =>
                      `${name}\t${row.id}\t${(row.updatedAt as string | null | undefined) ?? ""}`,
                  ),
              )
              .sort()
              .join("\n"),
          )
          .digest("hex")
      for (const id of others)
        if (giveUp[id] !== fingerprint(id))
          return json({ code: "CVNEW", message: "changed" }, 400)
      for (const id of others)
        for (const [name, rows] of server)
          for (const [rowId, row] of rows)
            if (name === "courses" ? rowId === id : row.courseId === id)
              rows.delete(rowId)
      if (state.keepAnswer === "lost") return route.abort("connectionreset")
      return route.fulfill({ status: 204 })
    }
    if (name.startsWith("rpc/")) return json(null)
    if (request.method() === "GET") return json([])
    if (state.held) await state.held
    const body = request.postDataJSON() as unknown
    const posted = (Array.isArray(body) ? body : body ? [body] : []) as Row[]
    for (const row of posted) table(name).set(row.id, row)
    return json(
      posted.map((row) => ({ id: row.id })),
      201,
    )
  })
  return { table, state }
}

/** The first course, its student, and signed in with everything sent. */
async function signedInCourse(page: Page, backend: Backend) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Tenuta")
  await page.getByLabel("Cognome", { exact: true }).fill("Sintetica")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("button", { name: /Tenuta/ })).toBeVisible()
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [authKey, session] as const,
  )
  const reopened = page.waitForEvent("load")
  await page.reload()
  await reopened
  await expect
    .poll(() => backend.table("students").size, { timeout: 30_000 })
    .toBe(1)
  return courseIds(page)
}

type Backend = Awaited<ReturnType<typeof withBackend>>

function courseIds(page: Page) {
  return page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    return (
      await db.getAll<{ id: string }>("SELECT id FROM courses ORDER BY id")
    ).map(({ id }) => id)
  })
}

/** Another course on the account, with `students` rows, in the local database. */
async function anotherCourse(
  page: Page,
  {
    id,
    level = 3,
    students = 2,
  }: { id: string; level?: number; students?: number },
) {
  await page.evaluate(
    async ({ id, level, students }) => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { db } = (await load(
        "/src/persistence/db.ts",
      )) as typeof import("../../src/persistence/db")
      const now = "2026-10-20T08:05:00.000Z"
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO courses(id, active, family, level, isoWeek, year, startDate, endDate, label, createdAt, updatedAt)
           VALUES (?, 1, 'Cabinato', ?, 45, 2026, '2026-11-07', '2026-11-14', ?, ?, ?)`,
          [id, level, `C${level} 45 2026`, now, now],
        )
        // Shaped like the first course's student: a whole, valid row.
        const [student] = await tx.getAll<Record<string, unknown>>(
          "SELECT * FROM students LIMIT 1",
        )
        const columns = Object.keys(student!)
        for (let n = 0; n < students; n += 1)
          await tx.execute(
            `INSERT INTO students(${columns.join(", ")})
             VALUES (${columns.map(() => "?").join(", ")})`,
            columns.map((column) =>
              column === "id"
                ? crypto.randomUUID()
                : column === "courseId"
                  ? id
                  : column === "firstName"
                    ? `Rinuncia${n}`
                    : column === "createdAt" || column === "updatedAt"
                      ? now
                      : (student![column] as string | number | null),
            ),
          )
      })
    },
    { id, level, students },
  )
}

/** What the download does once the server has erased the course. */
async function downloadRemoves(page: Page, id: string) {
  await page.evaluate(async (id) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        "DELETE FROM ps_data__synced_students WHERE json_extract(data, '$.courseId') = ?",
        [id],
      )
      await tx.execute("DELETE FROM ps_data__synced_courses WHERE id = ?", [id])
    })
  }, id)
}

/** The download's one checkpoint that swaps a course for another (SC-B7-2). */
async function downloadSwaps(page: Page, from: string, to: string) {
  await page.evaluate(
    async ({ from, to }) => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { db } = (await load(
        "/src/persistence/db.ts",
      )) as typeof import("../../src/persistence/db")
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO ps_data__synced_courses(id, data)
           SELECT ?, json_set(data, '$.level', 3, '$.label', 'C3 45 2026', '$.family', 'Cabinato')
           FROM ps_data__synced_courses WHERE id = ?`,
          [to, from],
        )
        await tx.execute(
          "DELETE FROM ps_data__synced_students WHERE json_extract(data, '$.courseId') = ?",
          [from],
        )
        await tx.execute("DELETE FROM ps_data__synced_courses WHERE id = ?", [
          from,
        ])
      })
    },
    { from, to },
  )
}

/** The fake has no sync stream: this is its status saying it is connected. */
async function reportConnected(page: Page) {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    const connected = Object.create(db.currentStatus, {
      connected: { value: true },
    }) as typeof db.currentStatus
    Object.defineProperty(db, "currentStatus", {
      configurable: true,
      get: () => connected,
    })
    ;(
      db as unknown as {
        iterateListeners: (
          call: (listener: {
            statusChanged?: (status: typeof connected) => void
          }) => void,
        ) => void
      }
    ).iterateListeners((listener) => listener.statusChanged?.(connected))
  })
}

/** Rows planted as they would be kept, with what the open then finds. */
async function localState(page: Page) {
  return page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    return {
      refusals: (
        await db.getAll<{ id: string }>(
          "SELECT id FROM uploadRefusals ORDER BY id",
        )
      ).map(({ id }) => id),
      marks: (
        await db.getAll<{ id: string }>(
          "SELECT id FROM meta WHERE id LIKE 'local:held-course:%' ORDER BY id",
        )
      ).map(({ id }) => id.slice("local:held-course:".length)),
      pending: (
        await db.getAll(
          "SELECT 1 FROM meta WHERE id = 'local:compaction-pending'",
        )
      ).length,
    }
  })
}

async function plantRefusals(
  page: Page,
  refusals: Array<{ id: string; data: string }>,
) {
  await page.evaluate(async (refusals) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.writeTransaction(async (tx) => {
      for (const { id, data } of refusals)
        await tx.execute(
          `INSERT INTO uploadRefusals(id, tableName, rowId, op, data, reason, refusedAt)
           VALUES (?, 'students', ?, 'PUT', ?, 'access', '2026-11-03T08:05:00.000Z')`,
          [id, `${id}-row`, data],
        )
    })
  }, refusals)
}

const openError = (page: Page) =>
  page.getByText("Non riesco ad aprire i dati locali")

const choiceHeading = (page: Page) =>
  page.getByRole("heading", { name: "Scegli il corso da tenere" })
const card = (page: Page, code: RegExp) =>
  page.getByRole("article", { name: code })

async function twoCourses(page: Page, backend: Backend) {
  const [kept] = await signedInCourse(page, backend)
  await anotherCourse(page, { id: "c0c0c0c0-0000-4000-8000-000000000001" })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  return kept!
}

test("two courses open on the choice, and keeping one opens it with every row", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)

  // Both show what tells them apart, with the account's email.
  const deriva = card(page, /D2/)
  const cabinato = card(page, /C3 - 45/)
  await expect(deriva.getByText("Deriva · livello 2")).toBeVisible()
  await expect(cabinato.getByText("Cabinato · livello 3")).toBeVisible()
  await expect(cabinato.getByRole("definition").first()).toHaveText("2")
  await expect(deriva.getByRole("definition").first()).toHaveText("1")
  await expect(cabinato.getByText(email)).toBeVisible()
  const lastChange = (course: typeof deriva) =>
    course.locator("p", { hasText: "Ultima modifica:" })
  await expect(lastChange(cabinato)).toContainText("2026")
  await expect(lastChange(deriva)).toContainText("oggi,")

  // Signing out stays within reach on this screen (review SP-B7-4).
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible({ timeout: 15_000 })

  // The confirmation: nothing irreversible until the box is ticked.
  await expect(
    deriva.getByRole("button", { name: "Tieni questo corso" }),
  ).toBeEnabled({
    timeout: 15_000,
  })
  await deriva.getByRole("button", { name: "Tieni questo corso" }).click()
  await expect(page.getByRole("heading", { name: /Tieni D2/ })).toBeVisible()
  await expect(
    page.getByText(/sarà eliminato da questo telefono, dal backup online/),
  ).toBeVisible()
  const erase = page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ })
  await expect(erase).toBeDisabled()

  // Annulla changes nothing.
  await page.getByRole("button", { name: "Annulla" }).click()
  await expect(choiceHeading(page)).toBeVisible()
  expect(backend.state.keeps).toEqual([])
  expect(await courseIds(page)).toHaveLength(2)

  await deriva.getByRole("button", { name: "Tieni questo corso" }).click()
  await page
    .getByRole("checkbox", { name: /Ho capito: C3 - 45 non si potrà/ })
    .check()
  await erase.click()
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible()
  expect(backend.state.keeps.map(({ keep }) => keep)).toEqual([kept])
  expect([...backend.table("courses").keys()]).toEqual([kept])
  // The device changes only when the download says so.
  expect(await courseIds(page)).toHaveLength(2)

  // The download takes the other away, and the app reopens by itself.
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /Tenuta/ })).toBeVisible()
  expect(await courseIds(page)).toEqual([kept])
})

test("each course saves its own file, also offline, where the choice waits for signal", async ({
  page,
  context,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  await context.setOffline(true)
  await expect(
    page.getByText(/Serve la connessione per scegliere/),
  ).toBeVisible()
  const deriva = card(page, /D2/)
  const cabinato = card(page, /C3 - 45/)
  await expect(
    deriva.getByRole("button", { name: "Tieni questo corso" }),
  ).toBeDisabled()
  // The approved disabled look, readable in the sun (review FU-B7-I5).
  await expect(
    deriva.getByRole("button", { name: "Tieni questo corso" }),
  ).toHaveCSS("color", "rgb(101, 118, 139)")
  await expect(
    deriva.getByRole("button", { name: "Tieni questo corso" }),
  ).toHaveCSS("opacity", "1")

  const download = page.waitForEvent("download")
  await cabinato.getByRole("button", { name: "Salva file" }).click()
  const saved = await download
  await expect(cabinato.getByRole("status")).toContainText(
    "dati personali degli allievi",
  )
  const archive = JSON.parse(readFileSync(await saved.path(), "utf8")) as {
    tables: {
      courses: Array<{ id: string }>
      students: Array<{ courseId: string }>
    }
  }
  expect(archive.tables.courses.map(({ id }) => id)).toEqual([
    "c0c0c0c0-0000-4000-8000-000000000001",
  ])
  expect(archive.tables.students).toHaveLength(2)
  expect(
    archive.tables.students.every(
      ({ courseId }) => courseId === "c0c0c0c0-0000-4000-8000-000000000001",
    ),
  ).toBe(true)

  const other = page.waitForEvent("download")
  await deriva.getByRole("button", { name: "Salva file" }).click()
  const second = JSON.parse(
    readFileSync(await (await other).path(), "utf8"),
  ) as { tables: { courses: Array<{ id: string }> } }
  expect(second.tables.courses.map(({ id }) => id)).toEqual([kept])
  expect(backend.state.keeps).toEqual([])
})

test("a server that does not answer leaves the choice open and says it may have arrived", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  backend.state.keepAnswer = "unavailable"
  const deriva = card(page, /D2/)
  await deriva
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(
    page.getByText(/Il backup online non ha risposto.*può essere arrivata/),
  ).toBeVisible()
  expect(await courseIds(page)).toHaveLength(2)
  expect(
    backend.table("courses").has("c0c0c0c0-0000-4000-8000-000000000001"),
  ).toBe(true)

  // Torna alla scelta, then again, this time reachable.
  await page.getByRole("button", { name: "Torna alla scelta" }).click()
  await expect(choiceHeading(page)).toBeVisible()
  await deriva.getByRole("button", { name: "Tieni questo corso" }).click()
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible()
  backend.state.keepAnswer = "server"
  await page.getByRole("button", { name: "Riprova" }).click()
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible()
  expect([...backend.table("courses").keys()]).toEqual([kept])
})

test("a course another device already gave up cannot be kept here", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  // Another device kept the first course while this one still shows both.
  await expect.poll(() => backend.table("courses").size).toBe(2)
  backend.table("courses").delete("c0c0c0c0-0000-4000-8000-000000000001")
  const cabinato = card(page, /C3 - 45/)
  await cabinato
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: D2/ }).check()
  await page.getByRole("button", { name: /Elimina D2 - \d+ e apri C3/ }).click()
  await expect(
    page.getByText(/Quel corso non è più nel backup online/),
  ).toBeVisible()
  expect([...backend.table("courses").keys()]).toEqual([kept])
  expect(await courseIds(page)).toHaveLength(2)
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
})

test("unsent changes are shown on their course and go up before the choice", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const [kept] = await signedInCourse(page, backend)
  backend.state.held = new Promise((resolve) => {
    backend.state.release = resolve
  })
  await anotherCourse(page, {
    id: "c0c0c0c0-0000-4000-8000-000000000001",
    students: 2,
  })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  const cabinato = card(page, /C3 - 45/)
  // The course row and its two students.
  await expect(
    cabinato.getByText(
      "3 modifiche fatte su questo telefono non sono ancora state inviate.",
    ),
  ).toBeVisible()
  await expect(
    card(page, /D2/).getByText(/non sono ancora state inviate/),
  ).toHaveCount(0)

  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await expect(
    page.getByText(/3 modifiche di C3 - 45 .* andranno al backup online/),
  ).toBeVisible()
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/Invio le modifiche/)).toBeVisible()
  // The server is not asked while the queue still holds the changes.
  expect(backend.state.keeps).toEqual([])
  backend.state.held = null
  backend.state.release!()
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible({
    timeout: 30_000,
  })
  expect(backend.state.keeps).toEqual([{ keep: kept, queuedRows: 3 }])
  expect(backend.table("students").size).toBe(1)
})

test("three courses: keeping one names both the others", async ({ page }) => {
  const backend = await withBackend(page)
  await signedInCourse(page, backend)
  await anotherCourse(page, { id: "c0c0c0c0-0000-4000-8000-000000000001" })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  await expect(card(page, /C3 - 45/)).toBeVisible()
  await anotherCourse(page, {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    level: 1,
    students: 1,
  })
  await page.reload()
  await expect(page.getByText("Questo account ha tre corsi")).toBeVisible()
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await expect(
    page.getByText(/saranno eliminati da questo telefono/),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Salva prima il file di C1 - 45/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Salva prima il file di C3 - 45/ }),
  ).toBeVisible()
  await page.getByRole("checkbox", { name: /Ho capito/ }).check()
  await page.getByRole("button", { name: /Elimina .* e apri D2/ }).click()
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible()
  expect(backend.table("courses").size).toBe(1)
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  // Two still here: the choice stays.
  await page.waitForTimeout(500)
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible()
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000002")
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
})

test("two courses with the same code are told apart at the irreversible step", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await signedInCourse(page, backend)
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.writeTransaction(async (tx) => {
      const [first] = await tx.getAll<Record<string, unknown>>(
        "SELECT * FROM courses LIMIT 1",
      )
      await tx.execute(
        `INSERT INTO courses(id, active, family, level, isoWeek, year, startDate, endDate, label, createdAt, updatedAt)
         VALUES ('c-gemello', 1, ?, ?, ?, ?, ?, ?, ?, '2026-11-02T10:00:00.000Z', '2026-11-02T10:00:00.000Z')`,
        [
          first!.family,
          first!.level,
          first!.isoWeek,
          first!.year,
          first!.startDate,
          first!.endDate,
          first!.label,
        ],
      )
    })
  })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  await expect(page.getByRole("article")).toHaveCount(2)
  await page
    .getByRole("article")
    .first()
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await expect(page.getByText(/\(0 allievi, /).first()).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /\(1 allievo, oggi/ }),
  ).toBeVisible()
})

test("signed out, the choice asks to sign in and the files still save", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await page.evaluate((key) => localStorage.removeItem(key), authKey)
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  await expect(
    page.getByText(/Per scegliere accedi al backup online/),
  ).toBeVisible()
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible()
  await expect(
    card(page, /D2/).getByRole("button", { name: "Tieni questo corso" }),
  ).toBeDisabled()
  await expect(card(page, /D2/).getByText(email)).toHaveCount(0)
  const download = page.waitForEvent("download")
  await card(page, /D2/).getByRole("button", { name: "Salva file" }).click()
  await download
})

test("a read-only device sees both courses and is told to update", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  // A newer app on the account: this version's data record says read-only.
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    const { encodeVersion, parseVersion } = (await load(
      "/src/domain/compatibility.ts",
    )) as typeof import("../../src/domain/compatibility")
    for (const [id, version] of [
      ["data:version", "9.9.0"],
      ["data:minimumWriter", "9.8.0"],
    ] as const)
      await db.execute("INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)", [
        id,
        encodeVersion(parseVersion(version)),
      ])
  })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Due corsi su questo account" }),
  ).toBeVisible()
  await expect(
    page.getByText(/Aggiorna l’app per scegliere quale tenere/),
  ).toBeVisible()
  await expect(page.getByRole("article")).toHaveCount(2)
  await expect(
    page.getByRole("button", { name: "Tieni questo corso" }),
  ).toHaveCount(0)
  // Its file would not be faithful to data newer than this app.
  await expect(page.getByRole("button", { name: "Salva file" })).toHaveCount(0)
})

test("the refused changes of a course given up leave with it", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  await page.evaluate(async (kept) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.writeTransaction(async (tx) => {
      for (const [id, table, rowId, course] of [
        [
          "refusal:gone",
          "students",
          "c0c0c0c0-0000-4000-8000-000000000001-s0",
          "c0c0c0c0-0000-4000-8000-000000000001",
        ],
        ["refusal:kept", "students", "s-kept", kept],
      ])
        await tx.execute(
          `INSERT INTO uploadRefusals(id, tableName, rowId, op, data, reason, refusedAt)
           VALUES (?, ?, ?, 'PUT', ?, 'access', '2026-11-03T08:05:00.000Z')`,
          [
            id,
            table,
            rowId,
            JSON.stringify({ courseId: course, firstName: "Rifiuto" }),
          ],
        )
    })
  }, kept)
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
  const left = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    return (
      await db.getAll<{ id: string }>("SELECT id FROM uploadRefusals")
    ).map(({ id }) => id)
  })
  expect(left).toEqual(["refusal:kept"])
  expect(await localState(page)).toMatchObject({ marks: [kept], pending: 0 })
})

test("the screen fits a narrow phone with large buttons", async ({
  page,
}, testInfo) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await page.setViewportSize({ width: 320, height: 640 })
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .waitFor()
  const measured = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll("main button")].filter(
      (button) => button.getBoundingClientRect().height < 44,
    ).length,
  }))
  expect(measured).toEqual({ overflow: 0, small: 0 })
  await page.screenshot({
    path: evidenceOutputPath(testInfo, "B7", "choice-320.png"),
    fullPage: true,
  })
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await expect(page.getByRole("heading", { name: /Tieni D2/ })).toBeVisible()
  const confirm = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll("main button")].filter(
      (button) => button.getBoundingClientRect().height < 44,
    ).length,
  }))
  expect(confirm).toEqual({ overflow: 0, small: 0 })
  await page.screenshot({
    path: evidenceOutputPath(testInfo, "B7", "confirm-320.png"),
    fullPage: true,
  })
})

test("at 320 px with 200% text the counts stay in their card and each step opens at its question", async ({
  page,
}, testInfo) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const lower = page.getByRole("article").last()
  await expect(
    lower.getByRole("button", { name: "Tieni questo corso" }),
  ).toBeEnabled({ timeout: 15_000 })
  const spill = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "main article, main article dl, main article dt",
      ),
    ]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.tagName),
  )
  expect(spill).toEqual([])
  await page.screenshot({
    path: evidenceOutputPath(testInfo, "B7", "choice-320-200.png"),
    fullPage: true,
  })
  await lower.getByRole("button", { name: "Tieni questo corso" }).click()
  const question = page.getByRole("heading", { name: /^Tieni / })
  await expect(question).toBeFocused()
  expect((await question.boundingBox())!.y).toBeGreaterThanOrEqual(0)
  await page.getByRole("button", { name: "Annulla" }).click()
  await expect(choiceHeading(page)).toBeFocused()
  expect((await choiceHeading(page).boundingBox())!.y).toBeGreaterThanOrEqual(0)
})

test("a course on the server this phone never received stops the choice, and nothing goes", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  await expect.poll(() => backend.table("courses").size).toBe(2)
  // A third device uploaded it; this phone's download has not brought it.
  backend.table("courses").set("mai-ricevuto", {
    id: "mai-ricevuto",
    updatedAt: "2026-11-01T10:00:00.000Z",
  })
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/non ha ancora ricevuto/)).toBeVisible()
  await expect(choiceHeading(page)).toBeVisible()
  expect([...backend.table("courses").keys()].sort()).toEqual(
    [kept, "c0c0c0c0-0000-4000-8000-000000000001", "mai-ricevuto"].sort(),
  )
})

test("a change this phone has not seen stops the choice, whatever its stamp, until it arrives", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await expect.poll(() => backend.table("students").size).toBe(3)
  const other = "c0c0c0c0-0000-4000-8000-000000000001"
  // Offline work reaches the server with the old stamp of the edit (SC-B7-9).
  const old = "2000-01-01T00:00:00.000Z"
  backend
    .table("students")
    .set("offline", { id: "offline", courseId: other, updatedAt: old })
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/non ha ancora ricevuto/)).toBeVisible()
  expect(backend.table("students").has("offline")).toBe(true)

  // The download brings it: the waiting is over, and the choice then works.
  await page.evaluate(
    async ({ other, old }) => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { db } = (await load(
        "/src/persistence/db.ts",
      )) as typeof import("../../src/persistence/db")
      await db.execute(
        "INSERT INTO ps_data__synced_students(id, data) VALUES (?, ?)",
        ["offline", JSON.stringify({ courseId: other, updatedAt: old })],
      )
    },
    { other, old },
  )
  await expect(page.getByText(/L’aggiornamento è arrivato/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/non ha ancora ricevuto/)).toHaveCount(0)
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click()
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect.poll(() => backend.table("courses").has(other)).toBe(false)
})

test("Riprova waits for the connection and says so", async ({
  page,
  context,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  backend.state.keepAnswer = "unavailable"
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/C3 - 45 sparirà da solo/)).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole("button", { name: "Riprova" })).toBeDisabled()
  await expect(
    page.getByText("Serve la connessione per riprovare."),
  ).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole("button", { name: "Riprova" })).toBeEnabled({
    timeout: 15_000,
  })
})

test("the reset on the choice clears this device and leaves the backup alone", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await expect(choiceHeading(page)).toBeVisible()
  await expect.poll(() => backend.table("students").size).toBe(3)
  const held = [...backend.table("courses").keys()].sort()
  const rpc = backend.state.keeps.length
  await page.getByRole("button", { name: "Azzera tutti i dati locali" }).click()
  await expect(
    page.getByText(/Il backup online non viene toccato/),
  ).toBeVisible()
  await page.getByRole("checkbox", { name: /Ho capito: corsi/ }).check()
  await page.getByRole("button", { name: "Azzera i dati" }).click()
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible({ timeout: 30_000 })
  expect([...backend.table("courses").keys()].sort()).toEqual(held)
  expect(backend.state.keeps.length).toBe(rpc)
})

test("a change of the course given up this phone has not seen stops the choice", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await expect.poll(() => backend.table("students").size).toBe(3)
  const other = "c0c0c0c0-0000-4000-8000-000000000001"
  backend.table("students").set("visto-altrove", {
    id: "visto-altrove",
    courseId: other,
    updatedAt: "2099-01-01T00:00:00.000Z",
  })
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/non ha ancora ricevuto/)).toBeVisible()
  expect(backend.table("courses").has(other)).toBe(true)
})

test("an answer lost after the server erased can be asked again, with no false comfort", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  backend.state.keepAnswer = "lost"
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/può essere arrivata/)).toBeVisible()
  await expect(page.getByText(/Non è stato eliminato nulla/)).toHaveCount(0)
  expect([...backend.table("courses").keys()]).toEqual([kept])
  backend.state.keepAnswer = "server"
  await page.getByRole("button", { name: "Riprova" }).click()
  await expect(page.getByText(/Scelta salvata nel backup online/)).toBeVisible()
})

test("a request that hangs ends on a screen with a way out", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  backend.state.keepAnswer = "hang"
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(page.getByText(/non chiudere/i)).toBeVisible()
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible({
    timeout: 35_000,
  })
  await page.getByRole("button", { name: "Torna alla scelta" }).click()
  await expect(choiceHeading(page)).toBeVisible()
})

test("a server refusal says nothing was erased", async ({ page }) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  backend.state.keepAnswer = "refused"
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }).click()
  await expect(
    page.getByText(/ha rifiutato la scelta. Non è stato eliminato nulla/),
  ).toBeVisible()
})

test("a change in what would go unticks the box", async ({ page }) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  const box = page.getByRole("checkbox", { name: /Ho capito/ })
  await box.check()
  await anotherCourse(page, {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    level: 1,
    students: 1,
  })
  await expect(
    page.getByRole("button", { name: /Elimina .* e apri D2/ }),
  ).toContainText("C1 - 45", { timeout: 10_000 })
  await expect(
    page.getByRole("checkbox", { name: /Ho capito/ }),
  ).not.toBeChecked()
  await expect(
    page.getByRole("button", { name: /Elimina .* e apri D2/ }),
  ).toBeDisabled()
})

test("the course chosen leaving returns to the choice between those left", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await anotherCourse(page, {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    level: 1,
    students: 1,
  })
  await page.reload()
  await card(page, /C3 - 45/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  await expect(page.getByText(/Il corso scelto non è più qui/)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole("article")).toHaveCount(2)
  await expect(
    page.getByRole("button", { name: "Tieni questo corso" }).first(),
  ).toBeEnabled()
})

test("the confirmation waits for signal, and asks nothing of the server offline", async ({
  page,
  context,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  await card(page, /D2/)
    .getByRole("button", { name: "Tieni questo corso" })
    .click({ timeout: 15_000 })
  await page.getByRole("checkbox", { name: /Ho capito: C3 - 45/ }).check()
  await context.setOffline(true)
  await expect(
    page.getByText(/Serve la connessione per scegliere/),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Elimina C3 - 45 e apri D2/ }),
  ).toBeDisabled()
  expect(backend.state.keeps).toEqual([])
})

test("a device that never held both: the swap reopens it and clears the course that left", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const [first] = await signedInCourse(page, backend)
  const arrived = "c0c0c0c0-0000-4000-8000-00000000000a"
  await plantRefusals(page, [
    {
      id: "refusal:left",
      data: JSON.stringify({ courseId: first, firstName: "Rifiutata" }),
    },
  ])
  expect((await localState(page)).marks).toEqual([first])
  const reopened = page.waitForEvent("load")
  await downloadSwaps(page, first!, arrived)
  await reportConnected(page)
  await reopened
  await expect(
    page.getByRole("heading", { name: /C3 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
  expect(await localState(page)).toEqual({
    refusals: [],
    marks: [arrived],
    pending: 0,
  })
  // The phone says what happened, until it is read (SC-B7-10, FU-B7-R3-I3).
  const swapNotice = page.getByText(
    /D2 - \d+ \| \d{4} è stato eliminato su un altro dispositivo.*Se c’erano modifiche/,
  )
  const course = page.getByRole("heading", { name: /C3 - \d+ \| \d{4}/ })
  await expect(swapNotice).toBeVisible()
  await page.reload()
  await expect(course).toBeVisible({ timeout: 15_000 })
  await expect(swapNotice).toBeVisible()
  await page.getByRole("button", { name: "Ho capito" }).click()
  await expect(swapNotice).toHaveCount(0)
  await page.reload()
  await expect(course).toBeVisible({ timeout: 15_000 })
  await expect(swapNotice).toHaveCount(0)
})

test("a second course arriving says typing may be lost, once", async ({
  page,
}) => {
  const backend = await withBackend(page)
  await signedInCourse(page, backend)
  const reopened = page.waitForEvent("load")
  await anotherCourse(page, { id: "c0c0c0c0-0000-4000-8000-000000000001" })
  await reportConnected(page)
  await reopened
  await expect(choiceHeading(page)).toBeVisible()
  await expect(page.getByText(/Se stavi scrivendo qualcosa/)).toBeVisible()
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  await expect(page.getByText(/Se stavi scrivendo qualcosa/)).toHaveCount(0)
})

test("two tabs opening on both courses at once both reach the choice", async ({
  page,
  context,
}) => {
  const backend = await withBackend(page)
  await twoCourses(page, backend)
  const second = await context.newPage()
  await withBackend(second)
  await second.goto("/")
  await expect(choiceHeading(second)).toBeVisible()
  for (let round = 0; round < 4; round += 1) {
    await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const { db } = (await load(
        "/src/persistence/db.ts",
      )) as typeof import("../../src/persistence/db")
      await db.execute("DELETE FROM meta WHERE id LIKE 'local:held-course:%'")
    })
    await Promise.all([page.reload(), second.reload()])
    await expect(choiceHeading(page)).toBeVisible()
    await expect(choiceHeading(second)).toBeVisible()
    await expect(openError(page)).toHaveCount(0)
    await expect(openError(second)).toHaveCount(0)
  }
})

test("housekeeping cannot fail an open: a write that fails, a refusal that cannot be read", async ({
  page,
}) => {
  const backend = await withBackend(page)
  const kept = await twoCourses(page, backend)
  // A write that fails, as on a full disk.
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.execute("DELETE FROM meta WHERE id LIKE 'local:held-course:%'")
    await db.execute(
      `CREATE TRIGGER b7_full_disk BEFORE INSERT ON ps_data_local__meta
       WHEN NEW.id LIKE 'local:held-course:%'
       BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END`,
    )
  })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()
  await expect(openError(page)).toHaveCount(0)
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    await db.execute("DROP TRIGGER b7_full_disk")
  })
  await page.reload()
  await expect(choiceHeading(page)).toBeVisible()

  // A refusal that cannot be read, once a course has left.
  await plantRefusals(page, [{ id: "refusal:broken", data: "{not json" }])
  await downloadRemoves(page, "c0c0c0c0-0000-4000-8000-000000000001")
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(openError(page)).toHaveCount(0)
  expect(await localState(page)).toEqual({
    refusals: [],
    marks: [kept],
    pending: 0,
  })
})
