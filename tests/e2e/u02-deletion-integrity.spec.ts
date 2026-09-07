import { expect, test } from "@playwright/test"

test("blocks every real reference class and deletes only an unused student", async ({
  page,
}) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/u02DeletionHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runU02DeletionHarness: () => Promise<{
        results: Array<{ expected: string; actual: string | null }>
        deleted: boolean
      }>
    }
    return harness.runU02DeletionHarness()
  })

  expect(result.results).toEqual([
    { expected: "duty", actual: "duty" },
    { expected: "stay-over", actual: "stay-over" },
    { expected: "crew", actual: "crew" },
    { expected: "land", actual: "land" },
    { expected: "evaluation", actual: "evaluation" },
  ])
  expect(result.deleted).toBe(true)
})
