/**
 * How a flaky test is named, in the `FLAKY:` line and in docs/working/BACKLOG.md,
 * where it is filed in backticks: `<spec file> › <test title>`.
 */
export function flakyEntry(test) {
  return `${test.file} › ${test.title}`
}

/**
 * Tests that failed first and passed on a retry, from Playwright's JSON report
 * (playwright.config.ts writes it to test-results/e2e-report.json).
 */
export function flakyTestsFrom(report) {
  const flaky = []
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === "flaky") {
          flaky.push({
            file: spec.file,
            title: spec.title,
            project: test.projectName,
          })
        }
      }
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites ?? []) visit(suite)
  return flaky
}
