import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"
import { openBlankPage } from "./fixtures/migration"

/**
 * B1 on the real PowerSync engine: a course from 0.1.0, 0.2.0, 0.3.0 or 0.4.0
 * switches to synced tables with every row identical and queued once, the
 * local copy emptied and older apps locked out; a reopen keeps it; an older
 * 0.4.0 app on the same database can neither write nor destroy anything; an
 * interrupted switch changes nothing; and the app itself opens a switched
 * course and queues what it saves.
 */

function record(name: string, result: unknown) {
  const info = test.info()
  const file = evidenceOutputPath(
    info,
    "B1",
    "sync-mode",
    `${name}-${info.project.name}.json`,
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

async function harness<T>(page: Page, name: string, argument?: string) {
  return page.evaluate(
    async ([exportName, value]) => {
      const modulePath = "/src/test/b1SyncModeHarness.ts"
      const module = (await import(/* @vite-ignore */ modulePath)) as Record<
        string,
        (input?: string) => Promise<unknown>
      >
      return module[exportName]!(value)
    },
    [name, argument] as const,
  ) as Promise<T>
}

for (const origin of ["0.1.0", "0.2.0", "0.3.0", "0.4.0"]) {
  test(`switches a ${origin} course to synced tables with every row identical and queued once`, async ({
    page,
  }) => {
    await openBlankPage(page)
    const result = await harness<Record<string, unknown>>(
      page,
      "runSwitch",
      origin,
    )
    record(`switch-${origin}`, result)

    // Courses before the contract record nothing; a 0.4.0 device records
    // what 0.4.0 wrote (B1 review DP-B1-Q1).
    expect(result.originRecord).toEqual(
      origin === "0.4.0"
        ? {
            version: { major: 0, minor: 4, patch: 0 },
            minimumWriter: { major: 0, minor: 3, patch: 0 },
          }
        : null,
    )

    expect(result.rows).toBeGreaterThan(0)
    expect(result).toMatchObject({
      switched: "switched",
      identical: true,
      queuedOnce: true,
      queued: result.rows,
      onlyPuts: true,
      localAfter: 0,
      minimumWriter: { major: 0, minor: 5, patch: 0 },
      hint: "synced",
      again: "already",
      queueAgain: result.rows,
      reopenedMode: "synced",
      reopenedIdentical: true,
      olderAccess: "read-only",
      olderSees: 0,
      olderWrite: "refused",
      afterOlderIdentical: true,
      queueAfterOlder: result.rows,
    })
  })
}

test("an interrupted switch changes nothing", async ({ page }) => {
  await openBlankPage(page)
  const result = await harness<Record<string, unknown>>(
    page,
    "runInterruptedSwitch",
  )
  record("interrupted-switch", result)
  expect(result).toMatchObject({
    failure: "Error: cut short",
    mode: "local",
    identical: true,
    queue: 0,
    minimumWriter: { major: 0, minor: 4, patch: 0 },
    hint: "local",
  })
})

test("the app opens a switched course and queues what it saves", async ({
  page,
}) => {
  // Seeded from a blank page, once: a script in a routed page can run again
  // when the dev server reloads it to optimise a new dependency.
  await openBlankPage(page)
  const queuedAtSwitch = await harness<number>(page, "seedAndSwitchAppDatabase")
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Sincro")
  await page.getByLabel("Cognome", { exact: true }).fill("Prova")
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("15")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("button", { name: /Sincro, 15/ })).toBeVisible()

  await page.reload()
  const student = page.getByRole("button", { name: /Sincro, 15/ })
  const students = page.getByRole("button", { name: "Allievi", exact: true })
  await expect(student.or(students).first()).toBeVisible()
  if (!(await student.isVisible())) await students.click()
  await expect(student).toBeVisible()

  const stored = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    const queue = await db.getAll("SELECT data FROM ps_crud")
    const synced = await db.getAll(
      "SELECT id FROM ps_data__synced_students WHERE data ->> '$.firstName' = 'Sincro'",
    )
    const local = await db.getAll(
      "SELECT count(*) AS n FROM inactive_local_students",
    )
    return {
      queue: queue.length,
      synced: synced.length,
      local: (local[0] as { n: number }).n,
    }
  })
  record("app-journey", { queuedAtSwitch, ...stored })
  // The new student, stamped and saved through the app, joins the queue.
  expect(stored.synced).toBe(1)
  expect(stored.local).toBe(0)
  expect(stored.queue).toBeGreaterThan(queuedAtSwitch)
})

test("the app erases a switched course, queues the deletion and keeps a new course synced", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openBlankPage(page)
  const queuedAtSwitch = await harness<number>(page, "seedAndSwitchAppDatabase")
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Deriva", exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()

  const stored = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = (await load(
      "/src/persistence/db.ts",
    )) as typeof import("../../src/persistence/db")
    const queue = (
      await db.getAll<{ data: string }>("SELECT data FROM ps_crud")
    ).map((row) => JSON.parse(row.data) as { op: string; type: string })
    const count = async (sql: string) =>
      (await db.getAll<{ n: number }>(sql))[0]?.n ?? -1
    return {
      deletes: queue.filter((entry) => entry.op === "DELETE").length,
      newCourse: queue.filter(
        (entry) => entry.op === "PUT" && entry.type === "synced_courses",
      ).length,
      syncedCourses: await count(
        "SELECT count(*) AS n FROM ps_data__synced_courses",
      ),
      syncedStudents: await count(
        "SELECT count(*) AS n FROM ps_data__synced_students",
      ),
      localRows: await count(
        "SELECT count(*) AS n FROM ps_data_local__courses",
      ),
      mode: await count(
        "SELECT value AS n FROM meta WHERE id = 'local:sync-mode'",
      ),
    }
  })
  record("app-erase", { queuedAtSwitch, ...stored })
  // Every row of the erased course is queued for deletion on the server (B6
  // sends it); the queue holds two course uploads, the switched course and
  // the new one, which is a synced row; nothing is local.
  expect(stored.deletes).toBe(queuedAtSwitch)
  expect(stored.newCourse).toBe(2)
  expect(stored).toMatchObject({
    syncedCourses: 1,
    syncedStudents: 0,
    localRows: 0,
    mode: 1,
  })
})

test("a course file imported on a switched device lands in the synced tables", async ({
  page,
}) => {
  await openBlankPage(page)
  const result = await harness<Record<string, unknown>>(page, "runSyncedImport")
  record("synced-import", result)
  // The replaced course is queued for deletion and the imported one for
  // upload, row for row; nothing reaches the emptied local copy.
  expect(result).toMatchObject({
    identical: true,
    mode: "synced",
    localRows: 0,
    deletes: result.replaced,
    puts: result.rows,
    // The file carries the data's minimum, so 0.4.0 can still import it; the
    // switched target keeps its own floor.
    fileMinimumWriter: { major: 0, minor: 4, patch: 0 },
    olderImport: "accepted",
    targetMinimumWriter: { major: 0, minor: 5, patch: 0 },
  })
})

for (const withCourse of [true, false]) {
  test(`an older app opening beside it refuses its next save ${withCourse ? "with a course" : "on an empty device"} and loses nothing`, async ({
    page,
  }) => {
    await openBlankPage(page)
    const result = await page.evaluate(async (course) => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const module = (await load(
        "/src/test/b1SyncModeHarness.ts",
      )) as typeof import("../../src/test/b1SyncModeHarness")
      return module.runOlderAppBesideOpenApp(course)
    }, withCourse)
    record(`older-beside-${withCourse ? "course" : "empty"}`, result)
    expect(result).toMatchObject({
      save: "CourseReplacedError",
      stranded: 0,
      restored: true,
    })
  })
}

test("every area of a switched course opens and reads its data", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openBlankPage(page)
  await harness<number>(page, "seedAndSwitchAppDatabase")
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()
  const navigation = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  // The six Home cards and Avarie, each read from the synced tables
  // (B1 review DI-B1-5); a failed read says "Non riesco a leggere" (for the
  // whole archive, "Non riesco ad aprire").
  for (const area of [
    "Allievi",
    "Barche",
    "Comandate",
    "Equipaggi",
    "Valutazioni",
    "Volontari",
    "Avarie",
  ]) {
    await navigation.getByRole("button", { name: "Home", exact: true }).click()
    const card =
      area === "Avarie"
        ? navigation.getByRole("button", { name: "Avarie", exact: true })
        : page.getByRole("button", { name: area, exact: true }).first()
    await card.click()
    await expect(
      page.getByRole("heading", { name: area }).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/Non riesco a leggere|Non riesco ad aprire/),
    ).toHaveCount(0)
  }
})

test("a full reset in synced mode removes the switched course and the mode", async ({
  page,
}) => {
  await openBlankPage(page)
  await harness<number>(page, "seedAndSwitchAppDatabase")
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  await page.getByRole("button", { name: "Azzera tutti i dati locali" }).click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: corso, preferenze e file offline saranno cancellati",
    })
    .check()
  await page.getByRole("button", { name: "Azzera i dati" }).click()
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()

  const after = await page.evaluate(async () => ({
    database: (await indexedDB.databases()).some(
      ({ name }) => name === "cvc-helper.db",
    ),
    hint: localStorage.getItem("cvc-helper.sync-mode"),
  }))
  record("full-reset", after)
  // The database itself is deleted, synced rows, queue and mode with it, and
  // the mode hint is cleared with the other preferences.
  expect(after).toEqual({ database: false, hint: null })
})
