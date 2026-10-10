import { describe, expect, it } from "vitest"

import { flakyTestsFrom } from "./e2e-report.mjs"

describe("flakyTestsFrom", () => {
  it("lists only the tests that passed on a retry, from nested suites", () => {
    const report = {
      suites: [
        {
          title: "smoke.spec.ts",
          specs: [
            {
              file: "smoke.spec.ts",
              title: "opens the app",
              tests: [
                { projectName: "pixel-7-chrome", status: "expected" },
                { projectName: "iphone-13-webkit-core", status: "flaky" },
              ],
            },
          ],
          suites: [
            {
              title: "describe block",
              specs: [
                {
                  file: "smoke.spec.ts",
                  title: "keeps a note",
                  tests: [
                    { projectName: "pixel-7-chrome", status: "flaky" },
                    { projectName: "pixel-7-chrome", status: "unexpected" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(flakyTestsFrom(report)).toEqual([
      {
        file: "smoke.spec.ts",
        title: "opens the app",
        project: "iphone-13-webkit-core",
      },
      {
        file: "smoke.spec.ts",
        title: "keeps a note",
        project: "pixel-7-chrome",
      },
    ])
  })

  it("is empty for a report without suites", () => {
    expect(flakyTestsFrom({})).toEqual([])
  })
})
