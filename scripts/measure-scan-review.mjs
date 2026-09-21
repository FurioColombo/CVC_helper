/**
 * Where does the review load of a scan actually come from?
 *
 * The owner photographed a clean roster on 2026-09-21 and was left with 67
 * fields to check. A count on its own cannot be acted on: 67 missing fields,
 * 67 low-confidence fields and 67 rows whose name order is undecided are three
 * different defects with three different fixes. This runs the real OCR over an
 * image and counts exactly the way the review screen counts, split by cause,
 * with the telephone read and not read.
 *
 * Usage:
 *   npm run measure:scan-review -- [image] [output.json]
 *
 * The image defaults to the committed clear fixture. Point it at a photograph
 * of a real sheet to attribute a real number.
 */
import { createRequire } from "node:module"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "..")
const require = createRequire(pathToFileURL(resolve(root, "package.json")).href)
const { createWorker, OEM, PSM } = require("tesseract.js")
const { extractStudentCandidates, MIN_FIELD_CONFIDENCE } = await import(
  pathToFileURL(resolve(root, "src/capabilities/studentScan.ts")).href
)

const imagePath = resolve(
  root,
  process.argv[2] ?? "tests/fixtures/ocr-sheet-clear.png",
)
const outputPath = process.argv[3] ? resolve(root, process.argv[3]) : null

const worker = await createWorker("ita", OEM.LSTM_ONLY, {
  corePath: resolve(root, "node_modules/tesseract.js-core"),
  langPath: resolve(root, "node_modules/@tesseract.js-data/ita/4.0.0_best_int"),
  logger: () => {},
})
await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
const started = Date.now()
const { data } = await worker.recognize(
  await readFile(imagePath),
  { rotateAuto: true },
  { text: true, tsv: true },
)
const recognitionMs = Date.now() - started
await worker.terminate()

/**
 * The screen's own arithmetic, kept deliberately literal rather than imported:
 * if these two ever drift the measurement is worthless, and a copy that reads
 * like the component is easier to check against it than an abstraction.
 */
function audit(readPhone) {
  const { candidates, unsuitable, aggregateConfidence } =
    extractStudentCandidates(data, { readPhone })
  const fields = readPhone
    ? ["firstName", "surname", "dateOfBirth", "phone"]
    : ["firstName", "surname", "dateOfBirth"]
  const uncertain = (candidate, field) =>
    field === "phone" && !candidate.phone.trim()
      ? false
      : candidate.confidence[field] < MIN_FIELD_CONFIDENCE
  const orderUndecided = (candidate) =>
    Boolean(candidate.nameReading) && candidate.nameReading.order === "unknown"

  const missingFields = candidates.reduce(
    (total, candidate) =>
      total +
      Number(!candidate.firstName.trim()) +
      Number(!candidate.surname.trim()) +
      Number(!candidate.dateOfBirth) +
      Number(!candidate.sex),
    0,
  )
  const lowConfidenceFields = candidates.reduce(
    (total, candidate) =>
      total + fields.filter((field) => uncertain(candidate, field)).length,
    0,
  )

  return {
    readPhone,
    unsuitable,
    aggregateConfidence,
    rows: candidates.length,
    rowsToReview: candidates.filter(
      (candidate) =>
        !candidate.firstName.trim() ||
        !candidate.surname.trim() ||
        !candidate.dateOfBirth ||
        !candidate.sex ||
        orderUndecided(candidate) ||
        fields.some((field) => uncertain(candidate, field)),
    ).length,
    // The three causes, separately, because they are three different fixes.
    missingFields,
    lowConfidenceFields,
    lowConfidenceByField: Object.fromEntries(
      fields.map((field) => [
        field,
        candidates.filter((candidate) => uncertain(candidate, field)).length,
      ]),
    ),
    unresolvedNameOrder: candidates.filter(orderUndecided).length,
    fieldsFlagged: missingFields + lowConfidenceFields,
  }
}

const measurement = {
  image: relative(root, imagePath).replaceAll("\\", "/"),
  measuredAt: new Date().toISOString(),
  runtime: process.version,
  recognitionMs,
  minFieldConfidence: MIN_FIELD_CONFIDENCE,
  withTelephone: audit(true),
  withoutTelephone: audit(false),
}

const report = JSON.stringify(measurement, null, 2)
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${report}\n`, "utf8")
}
console.log(report)
