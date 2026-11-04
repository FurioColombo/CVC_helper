import { createHash } from "node:crypto"

import { type BrowserContext, expect, type Page, test } from "@playwright/test"

import {
  base,
  call,
  clearAccount,
  env,
  keys,
  serverRows,
  token,
} from "./liveBackend"

/**
 * B7 against the owner's development backend, once the owner has run
 * supabase/migrations/20261104000000_keep_course.sql: two devices that each
 * make a course, one of them offline, reach the account's two courses; neither
 * locks, one choice settles every device with no row of the kept course lost,
 * and two devices choosing at once cannot erase both. Synthetic people only.
 */
test.skip(
  keys.some((key) => !env[key]) || !env.TEST_USER_2_EMAIL,
  "B7's live check needs the development test accounts in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

const headers = (access: string) => ({
  apikey: env.SUPABASE_ANON_KEY!,
  authorization: `Bearer ${access}`,
  "content-type": "application/json",
  "x-cvc-app-version": "0.5.3",
})

function keepCourse(
  access: string,
  keepId: string,
  giveUp: Record<string, string> = {},
) {
  return fetch(`${base()}/rest/v1/rpc/keep_course`, {
    method: "POST",
    headers: headers(access),
    body: JSON.stringify({ keep_id: keepId, give_up: giveUp }),
  })
}

/** What the app sends for a course here: it holds only these two tables. */
async function fingerprintOf(id: string, access: string) {
  const lines = async (table: string, filter: string) =>
    (
      (await serverRows(table, access, `,updatedAt&${filter}`)) as Array<{
        id: string
        updatedAt: string | null
      }>
    ).map((row) => `${table}\t${row.id}\t${row.updatedAt ?? ""}`)
  return createHash("sha256")
    .update(
      [
        ...(await lines("courses", `id=eq.${id}`)),
        ...(await lines("students", `courseId=eq.${id}`)),
      ]
        .sort()
        .join("\n"),
    )
    .digest("hex")
}

async function installed(access: string) {
  const response = await keepCourse(access, "no-such-course")
  return response.status !== 404
}

async function forgetErasedIds(access: string) {
  await fetch(`${base()}/rest/v1/erased_courses?id=neq.none`, {
    method: "DELETE",
    headers: headers(access),
  })
}

async function serverCourse(access: string, id: string, student?: string) {
  const now = new Date().toISOString()
  const course = await fetch(`${base()}/rest/v1/courses`, {
    method: "POST",
    headers: headers(access),
    body: JSON.stringify({
      id,
      active: 1,
      family: "Cabinato",
      level: 3,
      isoWeek: 45,
      year: 2026,
      startDate: "2026-11-07",
      endDate: "2026-11-14",
      label: "C3 45 2026",
      createdAt: now,
      updatedAt: now,
    }),
  })
  expect(course.status).toBe(201)
  if (student) {
    const row = await fetch(`${base()}/rest/v1/students`, {
      method: "POST",
      headers: headers(access),
      body: JSON.stringify({
        id: `${id}-student`,
        courseId: id,
        firstName: student,
        surname: "Sintetico",
        createdAt: now,
        updatedAt: now,
      }),
    })
    expect(row.status).toBe(201)
  }
}

/** A device of the account, signed in and knowing the account holds nothing. */
async function emptyDevice(context: BrowserContext) {
  const page = await context.newPage()
  await page.addInitScript(
    (config) => {
      window.__cvcBackupConfig = config
    },
    {
      supabaseUrl: env.SUPABASE_URL!,
      supabaseKey: env.SUPABASE_ANON_KEY!,
      powersyncUrl: env.POWERSYNC_URL!,
    },
  )
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  await page.reload()
  await expect(page.getByRole("button", { name: "Crea corso" })).toBeVisible({
    timeout: 60_000,
  })
  await expect
    .poll(
      () =>
        call<{ kind: string }>(page, "/src/backup/session.ts", "backupState"),
      { timeout: 90_000 },
    )
    .toMatchObject({ kind: "connected" })
  return page
}

async function createCourse(
  page: Page,
  family: "Deriva" | "Cabinato",
  level: 2 | 3,
  student: string,
) {
  await page.getByRole("button", { name: family, exact: true }).click()
  await page
    .getByRole("button", { name: `Livello ${level}`, exact: true })
    .click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /[DC]\d - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(student)
  await page.getByLabel("Cognome", { exact: true }).fill("Sintetico")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(student) }).first(),
  ).toBeVisible()
}

/** Whether the text is anywhere in this page's database storage (SP-B6-1). */
async function rawStorageHolds(page: Page, text: string) {
  return page.evaluate(async (text) => {
    const needle = new TextEncoder().encode(text)
    const holds = (bytes: Uint8Array) => {
      outer: for (let i = 0; i <= bytes.length - needle.length; i += 1) {
        for (let j = 0; j < needle.length; j += 1)
          if (bytes[i + j] !== needle[j]) continue outer
        return true
      }
      return false
    }
    const walk = async (value: unknown): Promise<boolean> => {
      if (value instanceof Blob)
        return holds(new Uint8Array(await value.arrayBuffer()))
      if (value instanceof ArrayBuffer) return holds(new Uint8Array(value))
      if (ArrayBuffer.isView(value))
        return holds(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        )
      if (typeof value === "string") return value.includes(text)
      if (value && typeof value === "object")
        for (const entry of Object.values(value))
          if (await walk(entry)) return true
      return false
    }
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error as Error)
      })
      for (const store of database.objectStoreNames) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const request = database
            .transaction(store)
            .objectStore(store)
            .getAll()
          request.onsuccess = () => resolve(request.result as unknown[])
          request.onerror = () => reject(request.error as Error)
        })
        for (const row of rows) if (await walk(row)) return true
      }
      database.close()
    }
    return false
  }, text)
}

const choice = (page: Page) =>
  page.getByRole("heading", { name: "Scegli il corso da tenere" })

test("two devices that each made a course, one offline: neither locks, and one choice settles both", async ({
  browser,
}) => {
  test.setTimeout(420_000)
  const access = await token(1)
  test.skip(!(await installed(access)), "keep_course is not installed yet")
  await clearAccount(access)
  await forgetErasedIds(access)

  const first = await browser.newContext()
  const second = await browser.newContext()
  try {
    const kept = await emptyDevice(first)
    const given = await emptyDevice(second)

    // One device offline makes a course; the other makes its own online.
    await second.setOffline(true)
    await createCourse(given, "Cabinato", 3, "Rinuncia")
    await createCourse(kept, "Deriva", 2, "Tenuta")
    await expect
      .poll(async () => (await serverRows("students", access)).length, {
        timeout: 60_000,
      })
      .toBe(1)

    // Signal back: its course goes up and the other comes down. Each device
    // reopens on the choice by itself, without a reload from here.
    await second.setOffline(false)
    await expect
      .poll(async () => (await serverRows("courses", access)).length, {
        timeout: 90_000,
      })
      .toBe(2)
    await expect(choice(kept)).toBeVisible({ timeout: 120_000 })
    await expect(choice(given)).toBeVisible({ timeout: 120_000 })
    expect(await rawStorageHolds(kept, "Rinuncia")).toBe(true)

    const deriva = kept.getByRole("article", { name: /D2/ })
    await expect(deriva.getByText(env.TEST_USER_1_EMAIL!)).toBeVisible()
    await expect(deriva.getByRole("definition").first()).toHaveText("1")
    await deriva
      .getByRole("button", { name: "Tieni questo corso" })
      .click({ timeout: 60_000 })
    await kept.getByRole("checkbox", { name: /Ho capito: C3/ }).check()
    await kept.getByRole("button", { name: /Elimina C3 .* e apri D2/ }).click()

    // Both devices open on the kept course, with its row, by themselves.
    for (const page of [kept, given]) {
      await expect(
        page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
      ).toBeVisible({ timeout: 120_000 })
      await page.getByRole("button", { name: "Allievi", exact: true }).click()
      await expect(
        page.getByRole("button", { name: /Tenuta/ }).first(),
      ).toBeVisible()
    }
    const courses = await serverRows("courses", access)
    expect(courses).toHaveLength(1)
    expect((await serverRows("students", access)).length).toBe(1)

    // Nothing of the course given up stays in either device's storage.
    for (const page of [kept, given])
      expect(await rawStorageHolds(page, "Rinuncia")).toBe(false)

    // An edit made after the choice still reaches the server.
    await kept
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("button", { name: "Home", exact: true })
      .click()
    await expect
      .poll(
        () =>
          call<number>(
            kept,
            "/src/persistence/backupLink.ts",
            "pendingUploads",
          ),
        { timeout: 60_000 },
      )
      .toBe(0)
  } finally {
    await first.close()
    await second.close()
  }
})

test("two devices choosing at once keep exactly one course, and only the account's", async () => {
  test.setTimeout(120_000)
  const access = await token(1)
  test.skip(!(await installed(access)), "keep_course is not installed yet")
  const stranger = await token(2)
  for (let round = 0; round < 5; round += 1) {
    await clearAccount(access)
    await forgetErasedIds(access)
    const a = `b7-race-a-${round}-${Date.now()}`
    const b = `b7-race-b-${round}-${Date.now()}`
    await serverCourse(access, a, "Prima")
    await serverCourse(access, b, "Seconda")

    const seenA = await fingerprintOf(a, access)
    const seenB = await fingerprintOf(b, access)

    // Another account cannot keep, or erase, this one's courses.
    const refused = await keepCourse(stranger, a, { [b]: seenB })
    expect(refused.status).toBe(400)
    expect(((await refused.json()) as { code: string }).code).toBe("CVGON")
    expect(await serverRows("courses", access)).toHaveLength(2)

    // What the choice did not show stops it: a course, or another fingerprint.
    const unnamed = await keepCourse(access, a)
    expect(((await unnamed.json()) as { code: string }).code).toBe("CVNEW")
    const older = await keepCourse(access, a, {
      [b]: "0".repeat(64),
    })
    expect(((await older.json()) as { code: string }).code).toBe("CVNEW")
    expect(await serverRows("courses", access)).toHaveLength(2)

    const answers = await Promise.all([
      keepCourse(access, a, { [b]: seenB }),
      keepCourse(access, b, { [a]: seenA }),
    ])
    const statuses = answers.map(({ status }) => status).sort()
    expect(statuses[0]).toBeLessThan(300)
    expect(statuses[1]).toBe(400)
    const left = await serverRows("courses", access)
    expect(left).toHaveLength(1)
    expect(await serverRows("students", access)).toHaveLength(1)

    // The same choice again, as after a lost answer, changes nothing; the
    // course given up cannot be uploaded back.
    const lost = left[0]!.id === a ? b : a
    const again = await keepCourse(access, left[0]!.id, {
      [lost]: lost === a ? seenA : seenB,
    })
    expect(again.status).toBeLessThan(300)
    expect(await serverRows("courses", access)).toHaveLength(1)
    const back = await fetch(`${base()}/rest/v1/courses`, {
      method: "POST",
      headers: headers(access),
      body: JSON.stringify({
        id: lost,
        active: 1,
        family: "Cabinato",
        level: 3,
        isoWeek: 45,
        year: 2026,
      }),
    })
    expect(back.status).toBeGreaterThanOrEqual(400)
  }
  await clearAccount(access)
  await forgetErasedIds(access)
})

test("no account may call it", async () => {
  const response = await fetch(`${base()}/rest/v1/rpc/keep_course`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ keep_id: "any", give_up: {} }),
  })
  test.skip(response.status === 404, "keep_course is not installed yet")
  // Refused by privilege: a mere CVGON here would mean anon holds EXECUTE
  // (review SP-B7-7).
  expect(((await response.json()) as { code: string }).code).toBe("42501")
})
