/**
 * How a flaky test is named, in the `FLAKY:` line and in docs/FLAKY_TESTS.md,
 * where it is filed in backticks: `<spec file> › <test title>`.
 */
export function flakyEntry(test) {
  return `${test.file} › ${test.title}`
}

/**
 * In CI the same line is also a GitHub warning annotation titled FLAKY, which
 * the public API returns without a token: `evidence --from-ci` reads a run's
 * flaky tests from it (CL-1a). GitHub's workflow commands escape %, CR and LF.
 */
export const FLAKY_ANNOTATION_TITLE = "FLAKY"

export function flakyAnnotation(test) {
  const message = `${flakyEntry(test)} [${test.project}]`
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
  return `::warning title=${FLAKY_ANNOTATION_TITLE}::${message}`
}

/** The test an annotation's message names, or null for any other message. */
export function flakyFromAnnotation(message) {
  const match = /^(.+?) › (.+) \[([\w-]+)\]$/s.exec(message ?? "")
  return match ? { file: match[1], title: match[2], project: match[3] } : null
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
