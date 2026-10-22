import { writeFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

// S1 spike (0.5.0): records what PowerSync keeps when one database moves from
// 0.4.0's local-only tables to synced ones and an older app opens it again.
// It asserts nothing about the outcome; it reports it, so it runs only on
// request: S1_PROBE=1 npx playwright test tests/e2e/s1-schema-probe.spec.ts
test.skip(!process.env.S1_PROBE, "S1 spike, run on request")

test("reports what a schema switch and an older app leave", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `<html><body>probe<script type="module">
        import { runProbe } from "/src/test/s1SchemaProbe.ts";
        window.probe = runProbe("s1-probe.db").then(
          (steps) => ({ steps }),
          (error) => ({ error: String(error && error.stack || error) }),
        );
      </script></body></html>`,
      })
    },
  )
  await page.goto("/")
  await page.waitForFunction(() => "probe" in window)
  const result = await page.evaluate(
    () => (window as unknown as { probe: Promise<unknown> }).probe,
  )
  writeFileSync(
    testInfo.outputPath("s1-schema-probe.json"),
    JSON.stringify(result, null, 2),
  )
  console.log(JSON.stringify(result, null, 2))
  expect(result).toBeTruthy()
})
