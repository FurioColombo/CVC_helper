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
  const sailor = crypto.randomUUID()
  const ashore = crypto.randomUUID()
  const crew = crypto.randomUUID()
  // A placed course, so the restore carries crews, placements and
  // evaluations too, and the export below validates them (DI-B5-4).
  const placed = [
    [
      "students",
      {
        id: ashore,
        courseId: course,
        firstName: "Aterra",
        surname: "Sintetico",
        declaredAgeAtCourseStart: 16,
        sex: "other",
        active: 1,
        createdAt: at,
        updatedAt: at,
      },
    ],
    [
      "crews",
      {
        id: crew,
        courseId: course,
        sessionId: "sat-pm",
        capacity: 2,
        destination: "unassigned",
        boatId: null,
        position: 0,
        createdAt: at,
        updatedAt: at,
      },
    ],
    [
      "crewMembers",
      {
        id: JSON.stringify(["member", crew, "student", sailor]),
        courseId: course,
        crewId: crew,
        personId: sailor,
        personType: "student",
        position: 0,
        createdAt: at,
        updatedAt: at,
      },
    ],
    [
      "landAssignments",
      {
        id: JSON.stringify(["land", "sat-pm", ashore]),
        courseId: course,
        sessionId: "sat-pm",
        studentId: ashore,
        createdAt: at,
        updatedAt: at,
      },
    ],
    [
      "evaluations",
      {
        id: JSON.stringify(["evaluation", sailor, "sat-pm"]),
        courseId: course,
        studentId: sailor,
        sessionId: "sat-pm",
        value: "+",
        note: "nota sintetica",
        createdAt: at,
        updatedAt: at,
      },
    ],
  ] as const
  expect(
    (
      await write(access, "students", {
        id: sailor,
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

  for (const [table, row] of placed)
    expect((await write(access, table, row)).status, table).toBe(201)

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

// A restored course takes the server's minimum writer during the restore:
// with the server's own value it is writable; with one above the app it opens
// read-only and asks for the update (B5 checklist; review SC-B5-1, -3). The
// function's answer is routed so both values go through the real restore;
// the real function, once the owner installs it, answers 0.5.0.
for (const [minimum, readOnly] of [
  ["0.5.0", false],
  ["9.0.0", true],
] as const)
  test(`a restore with the server minimum ${minimum} opens the course ${readOnly ? "read-only" : "writable"}`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const access = await token(1)
    await clearAccount(access)
    const real = await fetch(
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
    if (real.status !== 404) expect(await real.json()).toBe("0.5.0")

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
    let asked = 0
    await page.route("**/rest/v1/rpc/app_minimum_writer_version", (route) => {
      asked += 1
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(minimum),
      })
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
    // The app reopens on the restored course by itself.
    await expect(
      page.getByRole("heading", { name: /D2 - 44 \| 2026/ }),
    ).toBeVisible({ timeout: 90_000 })
    expect(asked).toBeGreaterThan(0)
    if (readOnly)
      await expect(page.getByText("Sola lettura:")).toBeVisible({
        timeout: 30_000,
      })
    else {
      await page.waitForTimeout(3_000)
      await expect(page.getByText("Sola lettura:")).toHaveCount(0)
    }
    await clearAccount(access)
  })
