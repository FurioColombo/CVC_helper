/**
 * Runs the V05 assistant-answer corpus through the paste parser and records,
 * per case, what was read and what was reported as unparsed. The corpus holds
 * only fictitious names. A case fails when a student appears that the case
 * does not expect, when an expected student is missing, or when an unparsed
 * line is not reported with its own text and a reason.
 *
 * Usage: node --import tsx scripts/record-roster-paste-robustness.mjs
 */
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "..")
const { parseRosterPaste } = await import(
  pathToFileURL(resolve(root, "src/capabilities/rosterPaste.ts")).href
)
const { ROSTER_PASTE_CORPUS } = await import(
  pathToFileURL(resolve(root, "src/capabilities/rosterPaste.corpus.ts")).href
)

const options = { courseStartDate: "2026-08-29", readPhone: false }
const cases = ROSTER_PASTE_CORPUS.map((entry) => {
  const result = parseRosterPaste(entry.answer, options)
  const read = result.candidates.map((candidate) => [
    candidate.surname,
    candidate.firstName,
    candidate.dateOfBirth,
    candidate.ageReading?.value ?? null,
  ])
  const lines = entry.answer.split(/\r\n|\r|\n/)
  const unexpectedStudents = read.filter(
    (row) =>
      !entry.students.some(
        (expected) => JSON.stringify(expected) === JSON.stringify(row),
      ),
  ).length
  const missingStudents = entry.students.filter(
    (expected) =>
      !read.some((row) => JSON.stringify(expected) === JSON.stringify(row)),
  ).length
  const unparsedWithoutTextOrReason = result.unparsed.filter(
    (line) => lines[line.line - 1]?.trim() !== line.text || !line.reason,
  ).length
  const rowsWithoutReviewWarning = result.candidates.filter(
    (candidate) => candidate.rowWarning !== "from-assistant",
  ).length
  return {
    case: entry.name,
    studentsRead: read.length,
    unparsedLines: result.unparsed.length,
    reasons: result.unparsed.map(({ reason }) => reason),
    complete: result.complete,
    formatMissing: result.formatMissing,
    unexpectedStudents,
    missingStudents,
    unparsedWithoutTextOrReason,
    rowsWithoutReviewWarning,
    pass:
      unexpectedStudents === 0 &&
      missingStudents === 0 &&
      result.unparsed.length === entry.unparsed &&
      unparsedWithoutTextOrReason === 0 &&
      rowsWithoutReviewWarning === 0,
  }
})

const report = {
  milestone: "V05",
  recordedAt: new Date().toISOString(),
  runtime: process.version,
  corpus: "src/capabilities/rosterPaste.corpus.ts (fictitious names only)",
  courseStartDate: options.courseStartDate,
  cases: cases.length,
  passed: cases.filter(({ pass }) => pass).length,
  silentlyWrongStudents: cases.reduce(
    (total, entry) => total + entry.unexpectedStudents,
    0,
  ),
  results: cases,
}
await mkdir(resolve(root, ".evidence/V05"), { recursive: true })
await writeFile(
  resolve(root, ".evidence/V05/parser-robustness.json"),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(
  `${report.passed}/${report.cases} cases pass; ${report.silentlyWrongStudents} silently wrong students`,
)
process.exitCode = report.passed === report.cases ? 0 : 1
