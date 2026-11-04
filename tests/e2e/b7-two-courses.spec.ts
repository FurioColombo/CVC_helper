import { readFileSync } from "node:fs"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * B7: an account holding several courses never locks a device. A fake backend
 * (no network leaves the test) keeps the server's rule: `keep_course` keeps
 * one course and erases the others, and refuses a course already gone (CVGON).
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
    keepAnswer: "server" as "server" | "unavailable",
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
      const keep = (request.postDataJSON() as { keep_id: string }).keep_id
      state.keeps.push({ keep, queuedRows: table("students").size })
      if (!table("courses").has(keep))
        return json({ code: "CVGON", message: "gone" }, 400)
      for (const id of [...table("courses").keys()])
        if (id !== keep) {
          table("courses").delete(id)
          for (const [rowId, row] of table("students"))
            if (row.courseId === id) table("students").delete(rowId)
        }
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

  const download = page.waitForEvent("download")
  await cabinato.getByRole("button", { name: "Salva file" }).click()
  const saved = await download
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

test("an erase that could not finish changes nothing and can be tried again", async ({
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
    page.getByText(/Non sono riuscito a eliminare C3 - 45 dal backup online/),
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
    page.getByText(/già stato eliminato su un altro dispositivo/),
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
    page.getByText(/3 modifiche di C3 - 45 .* andranno perse/),
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
    page.getByRole("heading", { name: /\(1 allievi, oggi/ }),
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
    return {
      refusals: (
        await db.getAll<{ id: string }>("SELECT id FROM uploadRefusals")
      ).map(({ id }) => id),
      mark: await db.getAll(
        "SELECT 1 FROM meta WHERE id = 'local:several-courses'",
      ),
    }
  })
  expect(left.refusals).toEqual(["refusal:kept"])
  expect(left.mark).toEqual([])
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
