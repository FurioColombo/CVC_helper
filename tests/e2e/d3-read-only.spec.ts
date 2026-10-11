import { expect, type Page, test } from "@playwright/test"

/**
 * D3 on the real engine: a course whose data a newer app wrote, beyond this
 * version's reach (03 §3.1), opens read-only. The course reads as usual, the
 * bottom bar says `aggiorna l'app`, a save through the screens is refused, an
 * edit never waits for a save (it leaves, or asks before dropping typed
 * work), and no repair or migration has written anything, also after a
 * reload.
 */

const isAppRoot = (target: URL) => target.pathname === "/"

/** The bottom bar in its read-only state (UpdateAvailableBanner). */
const readOnlyBar = (page: Page) =>
  page.getByRole("status").filter({
    hasText: "Sola lettura: aggiorna l’app per salvare le modifiche.",
  })

test("opens newer data read-only: it reads, says so, refuses a save and repairs nothing", async ({
  page,
}) => {
  await page.route(isAppRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body>Preparing<script type="module">
        import { seed } from "/src/test/d1MigrationHarness.ts";
        import { markNewerData } from "/src/test/d3Harness.ts";
        try {
          await seed("0.3.0", "cvc-helper.db");
          await markNewerData("cvc-helper.db");
          document.body.textContent = "newer data ready";
        } catch (error) {
          document.body.textContent = "seed failed: " + error;
        }
      </script></body></html>`,
    }),
  )
  await page.goto("/")
  await expect(page.getByText("newer data ready")).toBeVisible()
  await page.unroute(isAppRoot)

  const stored = () =>
    page.evaluate(async () => {
      const modulePath = "/src/persistence/db.ts"
      const { db } = (await import(/* @vite-ignore */ modulePath)) as {
        db: { get: (sql: string) => Promise<Record<string, number>> }
      }
      const count = async (table: string) =>
        (await db.get(`SELECT count(*) AS count FROM ${table}`)).count
      return {
        volunteers: await count("volunteers"),
        // 0.3.0 wrote no record metadata: a repair would have filled it.
        studentsStamped: await count("students WHERE createdAt IS NOT NULL"),
        version: (
          await db.get("SELECT value FROM meta WHERE id = 'data:version'")
        ).value,
      }
    })

  for (const pass of ["first open", "after a reload"]) {
    // Open Home, not the screen the browser history last held.
    await page.evaluate(() => history.replaceState(null, "", "/"))
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "D2 - 38 | 2026" }),
      pass,
    ).toBeVisible()
    await expect(readOnlyBar(page)).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Cerca aggiornamenti" }),
    ).toBeVisible()
    const before = await stored()

    await page.getByRole("button", { name: "Volontari" }).click()
    await page.getByRole("button", { name: "Aggiungi volontario" }).click()
    await page.getByLabel("Nome completo").fill("Rita Prova")
    await page.getByText("IS", { exact: true }).click()
    await page.getByRole("button", { name: "Salva volontario" }).click()
    await expect(
      page.getByText("La modifica non è stata salvata. Riprova."),
    ).toBeVisible()

    // D3 reviews RH-1, FU-2, FU-6: nothing saves, so no edit waits for a
    // save. With nothing typed its own Back leaves at once; typed work is
    // not dropped unseen: the form says it cannot be saved, and the
    // navigation leaves on "Esci senza salvare".
    await page.getByRole("button", { name: "Annulla" }).click()
    await page.getByRole("button", { name: "Indietro da Volontari" }).click()
    await page.getByRole("button", { name: "Allievi" }).click()
    await page.getByRole("button", { name: /^Irene,/ }).click()
    await page.getByRole("button", { name: "Modifica allievo" }).click()
    const editHeading = page.getByRole("heading", { name: "Modifica allievo" })
    await expect(editHeading).toBeVisible()
    await page
      .getByRole("button", { name: "Indietro da Modifica allievo" })
      .click()
    await expect(editHeading).toHaveCount(0)

    await page.getByRole("button", { name: "Modifica allievo" }).click()
    await page
      .getByRole("textbox", { name: "Nota del corso" })
      .fill("Non si salva")
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("button", { name: "Home" })
      .click()
    await expect(
      page.getByText(
        "Sola lettura: le modifiche non possono essere salvate finché non aggiorni l’app.",
      ),
    ).toBeVisible()
    await expect(editHeading).toBeVisible()
    await page.getByRole("button", { name: "Esci senza salvare" }).click()
    await expect(
      page.getByRole("heading", { name: "D2 - 38 | 2026" }),
    ).toBeVisible()

    expect(await stored(), pass).toEqual(before)
    expect(before.studentsStamped, pass).toBe(0)
    expect(before.version, pass).toBe(9_009_000)
  }
})

test("turns an open app read-only at its first save after a newer app raised the minimum writer", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Volontari" }).click()
  await expect(readOnlyBar(page)).toHaveCount(0)

  await page.evaluate(async () => {
    const modulePath = "/src/test/d3Harness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      raiseMinimumWriterUnderOpenApp: () => Promise<void>
    }
    await harness.raiseMinimumWriterUnderOpenApp()
  })

  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Rita Prova")
  await page.getByText("IS", { exact: true }).click()
  await page.getByRole("button", { name: "Salva volontario" }).click()

  await expect(
    page.getByText("La modifica non è stata salvata. Riprova."),
  ).toBeVisible()
  await expect(readOnlyBar(page)).toBeVisible()
  const volunteers = await page.evaluate(async () => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(/* @vite-ignore */ modulePath)) as {
      db: { get: (sql: string) => Promise<{ count: number }> }
    }
    return (await db.get("SELECT count(*) AS count FROM volunteers")).count
  })
  expect(volunteers).toBe(0)
})

// D3 review DI-R2-1: under the write guard the erase still compacts the file,
// so erased students do not stay behind in free pages.
test("erasing the course still compacts the database under the write guard", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await expect(page.getByRole("button", { name: "Volontari" })).toBeVisible()

  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { db } = await load("/src/persistence/db.ts")
    const { eraseAllCourseData, getActiveCourse } = await load(
      "/src/persistence/courses.ts",
    )
    const course = await getActiveCourse()
    const now = new Date().toISOString()
    await db.writeTransaction(
      async (transaction: {
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
      }) => {
        for (let index = 0; index < 300; index++) {
          await transaction.execute(
            `INSERT INTO students(
             id, courseId, firstName, surname, courseNote, active,
             createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            [
              `student-erase-${index}`,
              course.id,
              `Nome${index}`,
              `Cognomeprova${index}`,
              "Nota da cancellare ".repeat(20),
              now,
              now,
            ],
          )
        }
      },
    )
    const pages = async () =>
      (await db.get("PRAGMA page_count")).page_count as number
    const before = await pages()
    await eraseAllCourseData()
    return {
      before,
      after: await pages(),
      free: (await db.get("PRAGMA freelist_count")).freelist_count as number,
      students: (await db.get("SELECT count(*) AS count FROM students"))
        .count as number,
    }
  })

  expect(result.students).toBe(0)
  expect(result.free).toBe(0)
  expect(result.after).toBeLessThan(result.before)
})
