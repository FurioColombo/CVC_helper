import { describe, expect, it } from "vitest"

import {
  flakyAnnotation,
  flakyFromAnnotation,
  flakyTestsFrom,
} from "./e2e-report.mjs"

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

describe("the FLAKY annotation", () => {
  it("names the test in a form its reader recovers exactly", () => {
    const test = {
      file: "weather.spec.ts",
      title: "keeps 100% › of a copy\nacross lines",
      project: "iphone-13-webkit-core",
    }
    const line = flakyAnnotation(test)
    expect(line.startsWith("::warning title=FLAKY::")).toBe(true)
    expect(line).not.toContain("\n")
    const message = decodeURIComponent(
      line.slice("::warning title=FLAKY::".length),
    )
    expect(flakyFromAnnotation(message)).toEqual(test)
  })

  it("ignores other warnings", () => {
    expect(flakyFromAnnotation("Node.js 20 actions are deprecated")).toBeNull()
    expect(flakyFromAnnotation(undefined)).toBeNull()
  })
})
