import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

// T1 removed unnecessary browser cases partly by title patterns in
// playwright.config.ts. A pattern that stops matching (a renamed title, an
// unescaped character) would silently bring a case back or drop a kept one
// (T1 review CQ-2, CQ-8), so the configured suite itself is checked here.
type Spec = { title: string; tests: Array<{ projectName: string }> }
type Suite = { suites?: Suite[]; specs?: Spec[] }

function listed() {
  const raw = execFileSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--list",
      "--reporter=json",
    ],
    { encoding: "utf8", maxBuffer: 32 << 20 },
  )
  const report = JSON.parse(raw) as { suites: Suite[] }
  const byProject = new Map<string, string[]>()
  const walk = (suite: Suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) {
        const titles = byProject.get(test.projectName) ?? []
        titles.push(spec.title)
        byProject.set(test.projectName, titles)
      }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites) walk(suite)
  return byProject
}

describe("browser project scoping", () => {
  const projects = listed()
  const titles = (project: string) => projects.get(project) ?? []
  const anywhere = (title: string) =>
    [...projects.values()].some((list) => list.includes(title))

  it("keeps exactly the two cases measured at the iPhone viewport", () => {
    expect([...titles("iphone-13-viewport")].sort()).toEqual([
      "export feedback stays above the bottom bar (device)",
      "pages outgoing boats with pointer and touch without losing taps or keyboard access",
    ])
  })

  it("excludes each removed duplicate only where it is covered, and the title still exists", () => {
    const excluded: Array<[string, string]> = [
      [
        "pixel-7-chrome",
        "manages boats and simultaneous faults through detail and global entry",
      ],
      [
        "desktop-chrome-storage",
        "course-file and reset controls remain usable at narrow widths and enlarged text",
      ],
      [
        "desktop-chrome-storage",
        "refuses corrupt, invalid and too-new files without changing the current course",
      ],
    ]
    for (const [project, title] of excluded) {
      expect(titles(project)).not.toContain(title)
      expect(anywhere(title)).toBe(true)
    }
    expect(
      titles("iphone-13-webkit-core").some((title) =>
        title.startsWith("copies double names, a crew with no boat"),
      ),
    ).toBe(false)
    expect(
      titles("pixel-7-chrome").some((title) =>
        title.startsWith("copies double names, a crew with no boat"),
      ),
    ).toBe(true)
  })

  it("keeps one canonical boat default in the browser", () => {
    expect(
      titles("pixel-7-chrome").filter((title) =>
        title.startsWith("keeps the canonical default for"),
      ),
    ).toEqual(["keeps the canonical default for Cabinato 1"])
  })
})
