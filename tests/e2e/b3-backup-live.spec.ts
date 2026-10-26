import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"

/**
 * B3 end to end against the owner's development backend, on this PC only
 * (the ignored `.env`; never CI, never production): a course made offline is
 * signed in, switched, uploaded whole, and kept on the device after sign-out.
 * Test account 1 signs in by password (tests cannot open an emailed link;
 * the link itself is the owner's phone check). Nothing secret is recorded.
 */
const env: Record<string, string> = {}
if (existsSync(".env"))
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) env[match[1]!] = match[2]!.trim()
  }
const keys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "POWERSYNC_URL",
  "TEST_USER_1_EMAIL",
  "TEST_USER_1_PASSWORD",
]
test.skip(
  keys.some((key) => !env[key]),
  "B3's live check needs the development credentials in the ignored .env",
)
const linkedInstance = /instance_id:\s*(\S+)/.exec(
  readFileSync("powersync/cli.yaml", "utf8"),
)?.[1]
test.use({ trace: "off", screenshot: "off", video: "off" })

const base = () => env.SUPABASE_URL!.replace(/\/$/, "")

async function token() {
  const response = await fetch(`${base()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: env.TEST_USER_1_EMAIL,
      password: env.TEST_USER_1_PASSWORD,
    }),
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { access_token: string }).access_token
}

async function serverRows(table: string, access: string, filter = "") {
  const response = await fetch(
    `${base()}/rest/v1/${table}?select=id${filter}`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${access}`,
      },
    },
  )
  return (await response.json()) as Array<{ id: string }>
}

async function clearAccount(access: string) {
  // The cascade (B2 hardening) takes every child with its course.
  await fetch(`${base()}/rest/v1/courses?id=neq.none`, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      authorization: `Bearer ${access}`,
    },
  })
}

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
