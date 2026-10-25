import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"
import { openBlankPage } from "./fixtures/migration"

/**
 * B2 against the owner's development backend (docs/working/BACKEND_SETUP_
 * 0.5.0.md). It runs only where the ignored `.env` holds the development
 * credentials, never in CI and never against production. Test account 1
 * creates a synthetic course; account 2 and the anonymous key must not read,
 * change, extend or delete it; PowerSync must send it to account 1 alone.
 * Nothing secret is printed or recorded: only statuses and synthetic ids.
 */
const envFile = path.resolve(".env")
const env: Record<string, string> = {}
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) env[match[1]!] = match[2]!.trim()
  }
}
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "POWERSYNC_URL",
  "TEST_USER_1_EMAIL",
  "TEST_USER_1_PASSWORD",
  "TEST_USER_2_EMAIL",
  "TEST_USER_2_PASSWORD",
]
test.skip(
  required.some((key) => !env[key]),
  "B2 needs the development credentials in the ignored .env",
)

// Fail closed if .env points anywhere but the linked development instance
// (B2 review SP-B2-Q1), and keep no trace: it would hold a live token (Q2).
const linkedInstance = /instance_id:\s*(\S+)/.exec(
  readFileSync(path.resolve("powersync/cli.yaml"), "utf8"),
)?.[1]
test.use({ trace: "off", screenshot: "off", video: "off" })
test.beforeAll(() => {
  if (!env.POWERSYNC_URL) return
  expect(
    linkedInstance && env.POWERSYNC_URL.includes(linkedInstance),
    ".env must point at the PowerSync development instance in powersync/cli.yaml",
  ).toBe(true)
})

const base = () => env.SUPABASE_URL!.replace(/\/$/, "")
const anonHeaders = () => ({ apikey: env.SUPABASE_ANON_KEY! })

async function signIn(n: 1 | 2) {
  const response = await fetch(`${base()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { ...anonHeaders(), "content-type": "application/json" },
    body: JSON.stringify({
      email: env[`TEST_USER_${n}_EMAIL`],
      password: env[`TEST_USER_${n}_PASSWORD`],
    }),
  })
  expect(response.status, `test account ${n} signs in`).toBe(200)
  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

async function rest(
  token: string | null,
  method: string,
  target: string,
  body?: unknown,
  extraPrefer = "",
) {
  const response = await fetch(`${base()}/rest/v1/${target}`, {
    method,
    headers: {
      ...anonHeaders(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      prefer: ["return=representation", extraPrefer].filter(Boolean).join(","),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let rows: unknown
  try {
    rows = JSON.parse(text)
  } catch {
    rows = text
  }
  return { status: response.status, rows }
}

const count = (rows: unknown) => (Array.isArray(rows) ? rows.length : -1)

function record(name: string, result: unknown) {
  const info = test.info()
  const file = evidenceOutputPath(info, "B2", `${name}.json`)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

test("one account's course is closed to another account and to the anonymous key, and syncs to its owner alone", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const [first, second] = [await signIn(1), await signIn(2)]
  const courseId = `b2-check-${crypto.randomUUID()}`
  const studentId = `b2-check-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const result: Record<string, unknown> = {}
  try {
    const created = await rest(first, "POST", "courses", {
      id: courseId,
      active: 1,
      family: "Deriva",
      level: 2,
      isoWeek: 40,
      year: 2026,
      startDate: "2026-09-26",
      endDate: "2026-10-02",
      label: "B2 synthetic course",
      createdAt: now,
      updatedAt: now,
    })
    const student = await rest(first, "POST", "students", {
      id: studentId,
      courseId,
      firstName: "Prova",
      surname: "Sintetica",
      active: 1,
      createdAt: now,
      updatedAt: now,
    })
    result.owner = {
      createCourse: created.status,
      createStudent: student.status,
      readsOwn: count(
        (await rest(first, "GET", `courses?id=eq.${courseId}`)).rows,
      ),
    }

    const other = {
      reads: count(
        (await rest(second, "GET", `courses?id=eq.${courseId}`)).rows,
      ),
      readsStudents: count(
        (await rest(second, "GET", `students?courseId=eq.${courseId}`)).rows,
      ),
      updates: count(
        (
          await rest(second, "PATCH", `courses?id=eq.${courseId}`, {
            label: "changed by another account",
          })
        ).rows,
      ),
      addsStudent: (
        await rest(second, "POST", "students", {
          id: `b2-intruder-${crypto.randomUUID()}`,
          courseId,
          firstName: "Intruso",
          surname: "Sintetico",
          createdAt: now,
          updatedAt: now,
        })
      ).status,
      deletes: count(
        (await rest(second, "DELETE", `courses?id=eq.${courseId}`)).rows,
      ),
      takesOver: (
        await rest(second, "POST", "courses", {
          id: courseId,
          label: "taken over",
          createdAt: now,
          updatedAt: now,
        })
      ).status,
    }
    // The upload handler upserts: an "on conflict, update" under another
    // account's id must change nothing.
    const upsert = await rest(
      second,
      "POST",
      "courses",
      { id: courseId, label: "upserted by another account", updatedAt: now },
      "resolution=merge-duplicates",
    )
    ;(other as Record<string, unknown>).upserts =
      upsert.status >= 400 ? "refused" : count(upsert.rows)
    const anonymousResponse = await rest(
      null,
      "GET",
      `courses?id=eq.${courseId}`,
    )
    // Supabase's default grants let the anonymous role query; row-level
    // security then returns nothing. Either way no row reaches it.
    const anonymous =
      anonymousResponse.status >= 400
        ? "refused"
        : count(anonymousResponse.rows)
    result.otherAccount = other
    result.anonymousRead = anonymous
    result.ownerStillReads = count(
      (
        await rest(
          first,
          "GET",
          `courses?id=eq.${courseId}&label=eq.B2 synthetic course`,
        )
      ).rows,
    )

    // PowerSync, through its real web client, once replication has caught up.
    await openBlankPage(page)
    const sync = async (token: string) =>
      page.evaluate(
        async ([endpoint, value]) => {
          const load = (target: string) => import(/* @vite-ignore */ target)
          const module = (await load(
            "/src/test/b2SyncHarness.ts",
          )) as typeof import("../../src/test/b2SyncHarness")
          return module.syncedCourseIds(endpoint, value)
        },
        [env.POWERSYNC_URL!, token] as const,
      )
    let ownerSync = await sync(first)
    for (
      let attempt = 0;
      attempt < 5 && !ownerSync.courses.includes(courseId);
      attempt++
    ) {
      await page.waitForTimeout(3_000)
      ownerSync = await sync(first)
    }
    const otherSync = await sync(second)
    result.sync = {
      ownerReceivesCourse: ownerSync.courses.includes(courseId),
      ownerReceivesStudent: ownerSync.students.includes(studentId),
      otherReceivesCourse: otherSync.courses.includes(courseId),
      otherReceivesStudent: otherSync.students.includes(studentId),
    }
  } finally {
    // Only the course: its student must go with it (the hardening's cascade,
    // B2 review SP-B2-3). Row-level security hides a child whose course is
    // gone, so the proof recreates the course under the same id: an orphaned
    // student would reappear with it.
    await rest(first, "DELETE", `courses?id=eq.${courseId}`)
    await rest(first, "POST", "courses", {
      id: courseId,
      label: "B2 cascade probe",
      createdAt: now,
      updatedAt: now,
    })
    result.cascade =
      count(
        (await rest(first, "GET", `students?courseId=eq.${courseId}`)).rows,
      ) === 0
        ? "no orphan"
        : "orphan reappeared"
    await rest(first, "DELETE", `courses?id=eq.${courseId}`)
    result.cleanedUp =
      count((await rest(first, "GET", `courses?id=eq.${courseId}`)).rows) ===
        0 &&
      count(
        (await rest(first, "GET", `students?courseId=eq.${courseId}`)).rows,
      ) === 0
    record("access-check", { checkedAt: now, ...result })
  }

  expect(result.owner).toEqual({
    createCourse: 201,
    createStudent: 201,
    readsOwn: 1,
  })
  expect(result.otherAccount).toMatchObject({
    reads: 0,
    readsStudents: 0,
    updates: 0,
    deletes: 0,
  })
  // Inserting into another account's course is refused by row-level security.
  expect(
    (result.otherAccount as { addsStudent: number }).addsStudent,
  ).toBeGreaterThanOrEqual(400)
  expect(
    (result.otherAccount as { takesOver: number }).takesOver,
  ).toBeGreaterThanOrEqual(400)
  // The hardening removed the anonymous role's grants (SP-B2-1).
  expect(result.anonymousRead).toBe("refused")
  expect([0, "refused"]).toContain(
    (result.otherAccount as { upserts: unknown }).upserts,
  )
  expect(result.ownerStillReads).toBe(1)
  expect(result.sync).toEqual({
    ownerReceivesCourse: true,
    ownerReceivesStudent: true,
    otherReceivesCourse: false,
    otherReceivesStudent: false,
  })
  expect(result.cascade).toBe("no orphan")
  expect(result.cleanedUp).toBe(true)
})
