import { expect, type Page, test } from "@playwright/test"

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
 * B6 against the owner's development backend: erasing the course on the
 * device erases it and every row of it on the server, also when the erase
 * was made offline and the phone reconnects later; the erased course is not
 * downloaded again. Once the owner has run
 * supabase/migrations/20261028000000_course_erase.sql, the erased id also
 * refuses a later upload of the course (another phone's). Synthetic people
 * only.
 */
test.skip(
  keys.some((key) => !env[key]),
  "B6's live check needs the development test account in the ignored .env",
)
test.use({ trace: "off", screenshot: "off", video: "off" })

const headers = (access: string) => ({
  apikey: env.SUPABASE_ANON_KEY!,
  authorization: `Bearer ${access}`,
  "content-type": "application/json",
  "x-cvc-app-version": "0.5.2",
})

async function erasedIdsInstalled(access: string) {
  const response = await fetch(`${base()}/rest/v1/erased_courses?select=id`, {
    headers: headers(access),
  })
  return response.status === 200
}

async function forgetErasedIds(access: string) {
  await fetch(`${base()}/rest/v1/erased_courses?id=neq.none`, {
    method: "DELETE",
    headers: headers(access),
  })
}

/** A course with a student, signed in, switched and wholly uploaded. */
async function backedUpCourse(page: Page, access: string) {
  await offlineCourse(page)
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Cancellando")
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
    .poll(
      async () =>
        (await serverRows("students", access, `&courseId=eq.${courseId}`))
          .length,
      { timeout: 90_000 },
    )
    .toBe(1)
  await expect
    .poll(() =>
      call<number>(page, "/src/persistence/backupLink.ts", "pendingUploads"),
    )
    .toBe(0)
  return courseId
}

async function eraseCourse(page: Page) {
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
  const reopened = page.waitForEvent("load")
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await reopened
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
}

const erasures = (page: Page) =>
  call<{ erase: string[] }>(
    page,
    "/src/persistence/backupLink.ts",
    "pendingServerErasures",
  ).then(({ erase }) => erase)

test("an erase takes the course and its rows off the server, for good", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  const installed = await erasedIdsInstalled(access)
  if (installed) await forgetErasedIds(access)
  const courseId = await backedUpCourse(page, access)

  await eraseCourse(page)

  await expect
    .poll(async () => (await serverRows("courses", access)).length, {
      timeout: 60_000,
    })
    .toBe(0)
  const students = await serverRows(
    "students",
    access,
    `&courseId=eq.${courseId}`,
  )
  expect(students).toEqual([])
  await expect.poll(() => erasures(page)).toEqual([])
  // Connected again on the empty account: nothing comes back.
  await page.waitForTimeout(5_000)
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()

  if (installed) {
    // Another phone uploading the erased course afterwards is refused.
    const late = await fetch(`${base()}/rest/v1/courses`, {
      method: "POST",
      headers: headers(access),
      body: JSON.stringify({ id: courseId, family: "deriva", level: 2 }),
    })
    const answer = (await late.json()) as { code?: string }
    expect(answer.code).toBe("CVERA")
    expect(await serverRows("courses", access)).toEqual([])
    await forgetErasedIds(access)
  } else {
    test.info().annotations.push({
      type: "not run",
      description:
        "The erased-id record waits for the owner's migration (B6-ERASE-RULES).",
    })
  }
  await clearAccount(access)
})

test("an erase made offline leaves the server's copy until signal, then erases it", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const access = await token(1)
  await clearAccount(access)
  if (await erasedIdsInstalled(access)) await forgetErasedIds(access)
  const courseId = await backedUpCourse(page, access)

  // The backend out of reach (the dev server cannot reload offline itself).
  const hosts = [`${base()}/**`, `${env.POWERSYNC_URL!.replace(/\/$/, "")}/**`]
  for (const host of hosts) await page.route(host, (route) => route.abort())
  await eraseCourse(page)
  expect(await erasures(page)).toEqual([courseId])
  expect(await serverRows("courses", access)).toHaveLength(1)

  for (const host of hosts) await page.unroute(host)
  // The emptied device shows the backup on its first screen.
  await page
    .getByRole("region", { name: "Ripristina dal backup online" })
    .getByRole("button", { name: "Riprova", exact: true })
    .click()
  await expect
    .poll(async () => (await serverRows("courses", access)).length, {
      timeout: 90_000,
    })
    .toBe(0)
  await expect.poll(() => erasures(page)).toEqual([])
  await page.waitForTimeout(5_000)
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  if (await erasedIdsInstalled(access)) await forgetErasedIds(access)
  await clearAccount(access)
})
