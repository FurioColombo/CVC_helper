import { existsSync, readFileSync } from "node:fs"

import { expect, type Page } from "@playwright/test"

/**
 * The owner's development backend for the live specs, on this PC only (the
 * ignored `.env`; never CI, never production). Test accounts sign in by
 * password: tests cannot open an emailed link. Nothing secret is printed or
 * recorded.
 */
export const env: Record<string, string> = {}
if (existsSync(".env"))
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) env[match[1]!] = match[2]!.trim()
  }
export const keys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "POWERSYNC_URL",
  "TEST_USER_1_EMAIL",
  "TEST_USER_1_PASSWORD",
]
export const linkedInstance = /instance_id:\s*(\S+)/.exec(
  readFileSync("powersync/cli.yaml", "utf8"),
)?.[1]
export const base = () => env.SUPABASE_URL!.replace(/\/$/, "")

export async function token(n: 1 | 2 = 1) {
  const response = await fetch(`${base()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: env[`TEST_USER_${n}_EMAIL`],
      password: env[`TEST_USER_${n}_PASSWORD`],
    }),
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { access_token: string }).access_token
}

export async function serverRows(table: string, access: string, filter = "") {
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

export async function clearAccount(access: string) {
  // The cascade (B2 hardening) takes every child with its course.
  await fetch(`${base()}/rest/v1/courses?id=neq.none`, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      authorization: `Bearer ${access}`,
      // The server's writer check (B4) refuses app writes without a version.
      "x-cvc-app-version": "0.5.0",
    },
  })
}

export async function offlineCourse(page: Page) {
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
  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
}

export async function call<T>(
  page: Page,
  target: string,
  name: string,
  ...args: string[]
) {
  return page.evaluate(
    async ([module, exported, values]) => {
      const loader = (path: string) => import(/* @vite-ignore */ path)
      const loaded = (await loader(module)) as Record<
        string,
        (...input: string[]) => unknown
      >
      return loaded[exported]!(...values)
    },
    [target, name, args] as const,
  ) as Promise<T>
}

// B3 review SP-B3-1, -3: a second account never uploads the first account's
// queue nor receives its course.
