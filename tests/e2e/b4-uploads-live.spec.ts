import { expect, test } from "@playwright/test"

import {
  base,
  call,
  clearAccount,
  env,
  keys,
  offlineCourse,
  serverRows,
  token,
} from "./liveBackend"

/**
 * B4 against the owner's development backend: a course whose id another
 * account already holds online (a shared course file signed in first, B2
 * review SP-B2-Q5) is refused by the server, kept on the phone, reported in
 * Impostazioni, and never retried forever; the other account's course gains
 * nothing. Synthetic people only.
 */
test.skip(
  keys.some((key) => !env[key]) || !env.TEST_USER_2_EMAIL,
  "B4's live check needs both development test accounts in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

test("a course id held by another account is refused, kept and reported, not retried forever", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const [first, second] = [await token(1), await token(2)]
  await clearAccount(first)
  await clearAccount(second)
  await offlineCourse(page)
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Conteso")
  await page.getByLabel("Cognome", { exact: true }).fill("Sintetico")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  const courseId = await call<string>(
    page,
    "/src/persistence/backupLink.ts",
    "deviceCourseId",
  )

  // The other account holds the same course id online first.
  const taken = await fetch(`${base()}/rest/v1/courses`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY!,
      authorization: `Bearer ${second}`,
      "content-type": "application/json",
      "x-cvc-app-version": "0.5.0",
    },
    body: JSON.stringify({ id: courseId, family: "deriva", level: 2 }),
  })
  expect(taken.status).toBe(201)

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

  // Refused, recorded, and out of the queue: nothing waits for ever.
  await expect
    .poll(
      () =>
        call<unknown[]>(
          page,
          "/src/persistence/backupLink.ts",
          "uploadRefusals",
        ).then((refusals) => refusals.length),
      { timeout: 90_000 },
    )
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      call<number>(page, "/src/persistence/backupLink.ts", "pendingUploads"),
    )
    .toBe(0)
  const refusals = await call<Array<{ tableName: string; reason: string }>>(
    page,
    "/src/persistence/backupLink.ts",
    "uploadRefusals",
  )
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const section = page.getByRole("region", { name: "Backup online" })
  await expect(section.getByRole("alert")).toContainText(
    "Il corso risulta già di un altro account online",
  )

  const result = {
    courseRefusedAs: refusals.find(({ tableName }) => tableName === "courses")
      ?.reason,
    studentRefused: refusals.some(({ tableName }) => tableName === "students"),
    firstAccountCourses: (await serverRows("courses", first)).length,
    secondAccountStudents: (
      await serverRows("students", second, `&courseId=eq.${courseId}`)
    ).length,
  }
  await clearAccount(first)
  await clearAccount(second)
  expect(result).toEqual({
    courseRefusedAs: "other-account",
    studentRefused: true,
    firstAccountCourses: 0,
    secondAccountStudents: 0,
  })
})

// The server's writer check (supabase/migrations/20261026000000), once the
// owner has run it: an app below 0.5.0, or one that names no version, may
// not write; 0.5.0 may.
test("the server refuses writers below the minimum version", async () => {
  const access = await token(1)
  await clearAccount(access)
  const write = (version: string | null) =>
    fetch(`${base()}/rest/v1/courses`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${access}`,
        "content-type": "application/json",
        ...(version ? { "x-cvc-app-version": version } : {}),
      },
      body: JSON.stringify({ id: `writer-check-${version}`, level: 2 }),
    }).then(async (response) => ({
      status: response.status,
      code: response.ok
        ? null
        : ((await response.json()) as { code?: string }).code,
    }))
  const old = await write("0.4.9")
  if (old.status === 201) {
    await clearAccount(access)
    test.skip(true, "The owner has not run the writer-check migration yet")
  }
  const result = {
    old,
    unnamed: await write(null),
    current: (await write("0.5.0")).status,
  }
  await clearAccount(await token(1))
  expect(result).toEqual({
    old: { status: 400, code: "CVOLD" },
    unnamed: { status: 400, code: "CVOLD" },
    current: 201,
  })
})
