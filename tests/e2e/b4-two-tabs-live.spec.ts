import { type BrowserContext, expect, type Page, test } from "@playwright/test"

import {
  call,
  clearAccount,
  env,
  keys,
  offlineCourse,
  serverRows,
  token,
} from "./liveBackend"

/**
 * Two tabs on the owner's development backend: one syncs at a time, in the
 * tab, and neither undoes what the other was asked to do (reviews SC-DT-1,
 * SC-DT-2, on the desktop path). Synthetic people only.
 */
test.skip(
  keys.some((key) => !env[key]),
  "The live check needs the development test account in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

const LINK = "/src/persistence/backupLink.ts"
const SESSION = "/src/backup/session.ts"
const COURSE_HEADING = /D2 - \d+ \| \d{4}/
// The service's address: the SDK's own modules have this path too.
const stream = (url: URL) =>
  url.href.startsWith(env.POWERSYNC_URL!) &&
  url.pathname.endsWith("/sync/stream")

async function addStudent(page: Page, firstName: string) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill("Sintetico")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function uploaded(
  page: Page,
  access: string,
  courseId: string,
  students: number,
) {
  await expect
    .poll(
      async () =>
        (await serverRows("students", access, `&courseId=eq.${courseId}`))
          .length,
      { timeout: 90_000 },
    )
    .toBe(students)
  await expect.poll(() => call<number>(page, LINK, "pendingUploads")).toBe(0)
}

async function backedUpCourse(page: Page, access: string) {
  await offlineCourse(page)
  await addStudent(page, "Primo")
  const courseId = await call<string>(page, LINK, "deviceCourseId")
  await call(
    page,
    SESSION,
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  expect(await call<{ kind: string }>(page, SESSION, "startBackup")).toEqual({
    kind: "reopen",
  })
  await page.reload()
  await uploaded(page, access, courseId, 1)
  return courseId
}

async function secondTab(context: BrowserContext) {
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
    page.getByRole("heading", { name: COURSE_HEADING }),
  ).toBeVisible()
  await expect
    .poll(
      async () =>
        (await call<{ kind: string }>(page, SESSION, "backupState")).kind,
    )
    .toBe("connected")
  return page
}

async function openErase(page: Page) {
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
}

test("an erase stands while another tab holds the sync, its upload hung and the tab reloading", async ({
  context,
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  const courseId = await backedUpCourse(page, access)
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await expect(
    page.getByRole("heading", { name: COURSE_HEADING }),
  ).toBeVisible()

  // The upload hangs in the first tab, alone so far: the other opens after it
  // and takes the stream as soon as the erase lets the sync lock go.
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const students = /\/rest\/v1\/students/
  await page.route(students, async (route) => {
    if (route.request().method() === "GET") return route.continue()
    await released
    await route.continue().catch(() => {})
  })
  const hanging = page.waitForRequest(
    (request) => students.test(request.url()) && request.method() !== "GET",
  )
  await addStudent(page, "Sospeso")
  await hanging
  const other = await secondTab(context)
  await openErase(page)
  const reopened = page.waitForEvent("load")
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await page.waitForTimeout(1_500)
  await other.reload().catch(() => {})
  await page.waitForTimeout(2_500)
  release()
  await reopened

  await expect
    .poll(() => serverRows("courses", access, `&id=eq.${courseId}`), {
      timeout: 60_000,
    })
    .toEqual([])
  for (const tab of [page, other])
    await expect(
      tab.getByRole("heading", { name: "Crea il corso" }),
    ).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(() => call<boolean>(page, LINK, "awaitingServerErase"))
    .toBe(false)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  expect(await call<string | null>(page, LINK, "deviceCourseId")).toBeNull()
})

test("a course back on the device after its erase was confirmed is erased all the same", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const access = await token(1)
  await clearAccount(access)
  const courseId = await backedUpCourse(page, access)
  // As another tab's download leaves it after the erase (review SC-DT-1).
  await page.evaluate(async (id) => {
    const loader = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await loader("/src/persistence/db.ts")) as {
      db: { execute(sql: string, values: string[]): Promise<unknown> }
    }
    await db.execute(
      "INSERT OR REPLACE INTO serverErasures(id, erase, keep) VALUES (?, 1, 0)",
      [id],
    )
  }, courseId)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible({ timeout: 60_000 })
  expect(await serverRows("courses", access, `&id=eq.${courseId}`)).toEqual([])
  expect(await call<boolean>(page, LINK, "awaitingServerErase")).toBe(false)
})

test("a restore with another tab open waits for its own first download", async ({
  context,
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  await backedUpCourse(page, access)
  const other = await secondTab(context)
  await call(page, SESSION, "signOutOfBackup")
  await call(
    page,
    "/src/persistence/localDataOperations.ts",
    "resetAllLocalData",
  )
  for (const tab of [page, other])
    await expect(
      tab.getByRole("heading", { name: "Dati locali cancellati" }),
    ).toBeVisible({ timeout: 60_000 })
  await page.getByRole("button", { name: "Riapri l’app" }).click()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()

  // A slow download, in the tab that syncs.
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(stream, async (route) => {
    await released
    await route.continue().catch(() => {})
  })
  // In the tab: the SDK's shared sync worker cannot clone our configuration.
  const inTheTab = page.waitForRequest((request) =>
    stream(new URL(request.url())),
  )
  await call(
    page,
    SESSION,
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  // As after the emailed link: the app opens, switches and reopens.
  await page.reload()
  await inTheTab
  const restore = page.getByRole("region", {
    name: "Ripristina dal backup online",
  })
  await expect(restore).toContainText(
    "Ripristino del corso dal backup online…",
    { timeout: 30_000 },
  )
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 3", exact: true }).click()
  const create = page.getByRole("button", { name: "Crea corso" })
  await expect(create).toBeDisabled()
  await page.waitForTimeout(2_000)
  await expect(create).toBeDisabled()

  release()
  await expect(page.getByRole("heading", { name: COURSE_HEADING })).toBeVisible(
    { timeout: 60_000 },
  )
  expect(await serverRows("courses", access)).toHaveLength(1)
})

test("an edit in the tab that does not sync is sent by the one that does, and sync passes on when it closes", async ({
  context,
  page,
}, testInfo) => {
  // Phones have no shared database worker to tell the tab that syncs.
  test.skip(testInfo.project.name !== "desktop-chrome-backup")
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  const courseId = await backedUpCourse(page, access)
  const other = await secondTab(context)
  await addStudent(other, "Dallaltra")
  await uploaded(other, access, courseId, 2)

  await page.close()
  await other.getByRole("button", { name: "Indietro da Allievi" }).click()
  await addStudent(other, "Rimasta")
  await uploaded(other, access, courseId, 3)
  await expect
    .poll(() => call<boolean>(other, LINK, "databaseConnected"), {
      timeout: 30_000,
    })
    .toBe(true)
  await clearAccount(access)
})

test("a stalled connection is restarted from a hidden tab too", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  await backedUpCourse(page, access)

  // The tab that holds the sync can be the one in the background (review SC-DT-7).
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "hidden",
    })
  })
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route(stream, async (route) => {
    requests += 1
    await released
    await route.continue().catch(() => {})
  })
  await page.reload()
  await expect.poll(() => requests, { timeout: 30_000 }).toBe(1)
  await expect.poll(() => requests, { timeout: 120_000 }).toBeGreaterThan(1)

  release()
  await page.unroute(stream)
  await expect
    .poll(() => call<boolean>(page, LINK, "databaseConnected"), {
      timeout: 150_000,
    })
    .toBe(true)
  await clearAccount(access)
})
