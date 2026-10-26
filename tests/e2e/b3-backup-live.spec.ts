import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"
import {
  base,
  call,
  clearAccount,
  env,
  keys,
  linkedInstance,
  offlineCourse,
  serverRows,
  token,
} from "./liveBackend"

/**
 * B3 end to end against the owner's development backend, on this PC only
 * (the ignored `.env`; never CI, never production): a course made offline is
 * signed in, switched, uploaded whole, and kept on the device after sign-out.
 * Test account 1 signs in by password (tests cannot open an emailed link;
 * the link itself is the owner's phone check). Nothing secret is recorded.
 */
test.skip(
  keys.some((key) => !env[key]),
  "B3's live check needs the development credentials in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

test("a course made offline is signed in, uploaded whole and kept after sign-out", async ({
  page,
}) => {
  test.setTimeout(240_000)
  expect(linkedInstance && env.POWERSYNC_URL!.includes(linkedInstance)).toBe(
    true,
  )
  const access = await token()
  await clearAccount(access)
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

  // Offline work first: a course and a student, local only.
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Backup")
  await page.getByLabel("Cognome", { exact: true }).fill("Prova")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("button", { name: /Backup, 15/ })).toBeVisible()

  const load = async <T>(name: string, ...args: string[]) =>
    page.evaluate(
      async ([target, exported, values]) => {
        const loader = (module: string) => import(/* @vite-ignore */ module)
        const module = (await loader(target)) as Record<
          string,
          (...input: string[]) => Promise<unknown>
        >
        return module[exported]!(...values)
      },
      ["/src/backup/session.ts", name, args] as const,
    ) as Promise<T>

  // Sign-in switches the device; the app reopens and connects.
  await load(
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  expect(await load<{ kind: string }>("startBackup")).toEqual({
    kind: "reopen",
  })
  // The app reopens where it was (Allievi), now reading the synced tables.
  await page.reload()
  await expect(page.getByRole("button", { name: /Backup, 15/ })).toBeVisible()

  const link = async <T>(name: string) =>
    page.evaluate(async (exported) => {
      const loader = (module: string) => import(/* @vite-ignore */ module)
      const module = (await loader("/src/persistence/backupLink.ts")) as Record<
        string,
        () => Promise<unknown> | unknown
      >
      return module[exported]!()
    }, name) as Promise<T>
  await expect
    .poll(async () => link<number>("pendingUploads"), { timeout: 90_000 })
    .toBe(0)

  const courses = await serverRows("courses", access)
  const students = await serverRows("students", access, "&firstName=eq.Backup")

  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section.getByRole("status")).toHaveText(
    "Copia online aggiornata.",
    {
      timeout: 30_000,
    },
  )
  await section.getByRole("button", { name: "Esci", exact: true }).click()
  await section
    .getByRole("alertdialog")
    .getByRole("button", { name: "Esci", exact: true })
    .click()
  await expect(section.getByLabel("Email")).toBeVisible()
  // Signed out, the app reopens where it was (Impostazioni), course intact.
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /Backup, 15/ })).toBeVisible()
  const keptOffline = await page
    .getByRole("button", { name: /Backup, 15/ })
    .count()

  await clearAccount(access)
  const result = {
    serverCourses: courses.length,
    serverStudentFound: students.length,
    pendingAfterUpload: 0,
    keptAfterSignOut: keptOffline,
    serverClearedAfter: (await serverRows("courses", access)).length,
  }
  const file = evidenceOutputPath(test.info(), "B3", "live-backup.json")
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
  expect(result).toEqual({
    serverCourses: 1,
    serverStudentFound: 1,
    pendingAfterUpload: 0,
    keptAfterSignOut: 1,
    serverClearedAfter: 0,
  })
})

test("a second account on the same phone neither uploads nor takes the first account's course", async ({
  page,
}) => {
  test.setTimeout(240_000)
  test.skip(!env.TEST_USER_2_EMAIL, "needs test account 2")
  const [first, second] = [await token(1), await token(2)]
  await clearAccount(first)
  await clearAccount(second)
  await offlineCourse(page)
  // Writes cannot reach the server: the course stays queued.
  await page.route(`${base()}/rest/v1/**`, (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  )
  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  expect(
    await call<{ kind: string }>(page, "/src/backup/session.ts", "startBackup"),
  ).toEqual({ kind: "reopen" })
  await page.reload()
  await expect
    .poll(() =>
      call<number>(page, "/src/persistence/backupLink.ts", "pendingUploads"),
    )
    .toBeGreaterThan(0)
  const queued = await call<number>(
    page,
    "/src/persistence/backupLink.ts",
    "pendingUploads",
  )
  await call(page, "/src/backup/session.ts", "signOutOfBackup")
  await page.unroute(`${base()}/rest/v1/**`)

  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_2_EMAIL!,
    env.TEST_USER_2_PASSWORD!,
  )
  const second2 = await call<{ kind: string }>(
    page,
    "/src/backup/session.ts",
    "startBackup",
  )
  await page.waitForTimeout(5_000)
  const result = {
    secondAccount: second2.kind,
    queuedBefore: queued,
    queuedAfter: await call<number>(
      page,
      "/src/persistence/backupLink.ts",
      "pendingUploads",
    ),
    courseStillOnPhone:
      (await call<string | null>(
        page,
        "/src/persistence/backupLink.ts",
        "deviceCourseId",
      )) !== null,
    firstAccountCourses: (await serverRows("courses", first)).length,
    secondAccountCourses: (await serverRows("courses", second)).length,
  }
  await clearAccount(first)
  await clearAccount(second)
  expect(result).toEqual({
    secondAccount: "other-account",
    queuedBefore: queued,
    queuedAfter: queued,
    courseStillOnPhone: true,
    firstAccountCourses: 0,
    secondAccountCourses: 0,
  })
})

// B3 review SP-B3-2: sign-out offline with an expired session really forgets
// it; the next online launch stays signed out.
test("signing out offline with an expired session stays signed out", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  await offlineCourse(page)
  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  )
  await call(page, "/src/backup/session.ts", "startBackup")
  await page.reload()
  await expect
    .poll(
      () =>
        call<number>(page, "/src/persistence/backupLink.ts", "pendingUploads"),
      { timeout: 90_000 },
    )
    .toBe(0)
  await context.setOffline(true)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.endsWith(".backup-auth"),
    )!
    const session = JSON.parse(localStorage.getItem(key)!)
    session.expires_at = Math.floor(Date.now() / 1000) - 600
    localStorage.setItem(key, JSON.stringify(session))
  })
  await call(page, "/src/backup/session.ts", "signOutOfBackup")
  const storedAfterSignOut = await page.evaluate(() =>
    Object.keys(localStorage).some((name) => name.includes(".backup-auth")),
  )
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole("heading").first()).toBeVisible()
  const stateAfterReload = await call<{ kind: string }>(
    page,
    "/src/backup/session.ts",
    "startBackup",
  )
  await clearAccount(access)
  expect({
    storedAfterSignOut,
    stateAfterReload: stateAfterReload.kind,
  }).toEqual({
    storedAfterSignOut: false,
    stateAfterReload: "signed-out",
  })
})
