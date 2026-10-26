import { expect, test } from "@playwright/test"

import { base, call, clearAccount, env, keys, token } from "./liveBackend"

/**
 * B5 against the owner's development backend: an empty device signs in to
 * an account that holds a course, downloads it, reopens on it, and holds it
 * row for row as the server does. Synthetic people only.
 */
test.skip(
  keys.some((key) => !env[key]),
  "B5's live check needs the development credentials in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

const write = (access: string, table: string, rows: unknown) =>
  fetch(`${base()}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      authorization: `Bearer ${access}`,
      "content-type": "application/json",
      prefer: "return=minimal",
      "x-cvc-app-version": "0.5.0",
    },
    body: JSON.stringify(rows),
  })

test("an empty device restores the account's course and opens it", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  const course = crypto.randomUUID()
  const at = new Date().toISOString()
  // The account's course online, as another phone left it.
  expect(
    (
      await write(access, "courses", {
        id: course,
        active: 1,
        family: "Deriva",
        level: 2,
        isoWeek: 44,
        year: 2026,
        startDate: "2026-10-31",
        endDate: "2026-11-07",
        label: "D2 44 2026",
        createdAt: at,
        updatedAt: at,
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await write(access, "students", {
        id: crypto.randomUUID(),
        courseId: course,
        firstName: "Ripristino",
        surname: "Sintetico",
        declaredAgeAtCourseStart: 15,
        sex: "other",
        active: 1,
        createdAt: at,
        updatedAt: at,
      })
    ).status,
  ).toBe(201)

  // An empty device: the course creation screen, which offers the restore.
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
  await expect(
    page.getByRole("heading", { name: "Ripristina dal backup online" }),
  ).toBeVisible()

  // As after the emailed link: signing in alone switches the empty device,
  // which downloads the course and reopens on it.
  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  ).catch(() => {
    // The app may reopen before the call returns.
  })
  await expect(
    page.getByRole("heading", { name: /D2 - 44 \| 2026/ }),
  ).toBeVisible({ timeout: 90_000 })
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Ripristino,/ })).toBeVisible()
  expect(
    await call<string | null>(
      page,
      "/src/persistence/backupLink.ts",
      "deviceCourseId",
    ),
  ).toBe(course)

  // Row for row: every table of the restored course, as the export reads
  // it, equals the server's rows.
  const restored = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { exportCourseArchive } = (await load(
      "/src/persistence/courseArchive.ts",
    )) as {
      exportCourseArchive: () => Promise<{
        tables: Record<string, Array<Record<string, unknown>>>
      }>
    }
    return (await exportCourseArchive()).tables
  })
  for (const [table, rows] of Object.entries(restored)) {
    const server = (await fetch(
      `${base()}/rest/v1/${table}?select=*${table === "courses" ? `&id=eq.${course}` : `&courseId=eq.${course}`}`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY!,
          authorization: `Bearer ${access}`,
        },
      },
    ).then((response) => response.json())) as Array<Record<string, unknown>>
    const comparable = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row).filter(([column]) => column !== "ownerId"),
      )
    expect(
      server
        .map(comparable)
        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
      table,
    ).toEqual(
      rows
        .map((row) =>
          Object.fromEntries(
            Object.keys(server[0] ?? row)
              .filter((column) => column !== "ownerId")
              .map((column) => [column, row[column] ?? null]),
          ),
        )
        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    )
  }

  await clearAccount(access)
})

// A restored course whose minimum writer is newer than the app opens
// read-only and asks for the update (B5 adversarial checklist).
test("a restored course takes the server's minimum writer; a newer one opens read-only", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  const minimum = await fetch(
    `${base()}/rest/v1/rpc/app_minimum_writer_version`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${access}`,
        "content-type": "application/json",
      },
      body: "{}",
    },
  )
  // Until the owner runs the minimum-writer-read migration the function is
  // missing and the restore keeps the device's own minimum; the read-only
  // half below holds either way.
  if (minimum.status !== 404) expect(await minimum.json()).toBe("0.5.0")

  const course = crypto.randomUUID()
  const at = new Date().toISOString()
  await write(access, "courses", {
    id: course,
    active: 1,
    family: "Deriva",
    level: 2,
    isoWeek: 44,
    year: 2026,
    startDate: "2026-10-31",
    endDate: "2026-11-07",
    label: "D2 44 2026",
    createdAt: at,
    updatedAt: at,
  })
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
  await call(
    page,
    "/src/backup/session.ts",
    "signInForTests",
    env.TEST_USER_1_EMAIL!,
    env.TEST_USER_1_PASSWORD!,
  ).catch(() => {})
  await expect(
    page.getByRole("heading", { name: /D2 - 44 \| 2026/ }),
  ).toBeVisible({ timeout: 90_000 })
  // Writable with the server's own minimum.
  await expect(page.getByText("Sola lettura:")).toHaveCount(0)

  // A server minimum above this app, as a future release would set: the
  // restored course opens read-only after the reopen.
  await call(
    page,
    "/src/persistence/backupLink.ts",
    "adoptMinimumWriter",
    "9.0.0",
  )
  await page.reload()
  await expect(page.getByText("Sola lettura:")).toBeVisible({
    timeout: 30_000,
  })
  await clearAccount(access)
})
