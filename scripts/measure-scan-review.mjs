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
 *   npm run measure:scan-review -- [image] [output.json] [--reference-date=YYYY-MM-DD]
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
const {
  applyStudentNameOrder,
  extractStudentCandidates,
  inferStudentNameOrder,
  MIN_FIELD_CONFIDENCE,
  studentScanAgeCorroborated,
} = await import(
  pathToFileURL(resolve(root, "src/capabilities/studentScan.ts")).href
)

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const flag = (name) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1]

const imagePath = resolve(
  root,
  positional[0] ?? "tests/fixtures/ocr-sheet-clear.png",
)
const outputPath = positional[1] ? resolve(root, positional[1]) : null

/**
 * `--crop=left,top,width,height` as fractions of the image, standing in for
 * what the operator does in the crop editor before a scan. Fractions rather
 * than pixels so one value works across photographs of different sizes.
 */
const cropFractions = flag("crop")?.split(",").map(Number)

/**
 * `--order=surname-given` or `given-surname`: also report the counts as they
 * stand once the operator has answered the review's name-order question, which
 * is one tap for the whole sheet.
 */
const nameOrder = flag("order") ?? null
const referenceDate =
  flag("reference-date") ?? new Date().toISOString().slice(0, 10)

const bytes = await readFile(imagePath)

/**
 * Dimensions straight from the container, because there is no image library in
 * this project and adding one to crop a rectangle would be a poor trade.
 */
function imageSize(buffer) {
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    // SOF0-SOF15, excluding the four that are not frame headers.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + buffer.readUInt16BE(offset + 2)
  }
  throw new Error(`Could not read the dimensions of ${imagePath}`)
}

let rectangle
if (cropFractions) {
  const { width, height } = imageSize(bytes)
  const [left, top, cropWidth, cropHeight] = cropFractions
  rectangle = {
    left: Math.round(left * width),
    top: Math.round(top * height),
    width: Math.round(cropWidth * width),
    height: Math.round(cropHeight * height),
  }
}

const worker = await createWorker("ita", OEM.LSTM_ONLY, {
  corePath: resolve(root, "node_modules/tesseract.js-core"),
  langPath: resolve(root, "node_modules/@tesseract.js-data/ita/4.0.0_best_int"),
  logger: () => {},
})
await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
const started = Date.now()
const { data } = await worker.recognize(
  bytes,
  rectangle ? { rotateAuto: true, rectangle } : { rotateAuto: true },
  { text: true, tsv: true },
)
const recognitionMs = Date.now() - started
await worker.terminate()

/**
 * The screen's own arithmetic, kept deliberately literal rather than imported:
 * if these two ever drift the measurement is worthless, and a copy that reads
 * like the component is easier to check against it than an abstraction.
 */
function audit(readPhone, order = null, useAutomaticInference = true) {
  const extracted = extractStudentCandidates(data, { readPhone })
  const { unsuitable, aggregateConfidence } = extracted
  const inference = inferStudentNameOrder(extracted.candidates)
  const selectedOrder =
    order ??
    (useAutomaticInference && inference.order !== "unknown"
      ? inference.order
      : null)
  // The screen asks which name came first before anything can be committed,
  // and one answer applies to the whole sheet. Counting only the state before
  // that answer overstates the work by everything the answer resolves, so both
  // states are reported.
  const candidates = selectedOrder
    ? extracted.candidates.map((candidate) =>
        applyStudentNameOrder(candidate, selectedOrder),
      )
    : extracted.candidates
  const fields = readPhone
    ? ["firstName", "surname", "dateOfBirth", "phone"]
    : ["firstName", "surname", "dateOfBirth"]
  const uncertain = (candidate, field) =>
    field === "phone" && !candidate.phone.trim()
      ? false
      : field === "dateOfBirth" &&
          studentScanAgeCorroborated(candidate, referenceDate)
        ? false
        : candidate.confidence[field] < MIN_FIELD_CONFIDENCE
  const uncertainBeforeAgeCorroboration = (candidate, field) =>
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
  const lowConfidenceFieldsBeforeAgeCorroboration = candidates.reduce(
    (total, candidate) =>
      total +
      fields.filter((field) =>
        uncertainBeforeAgeCorroboration(candidate, field),
      ).length,
    0,
  )
  const corroboratedDates = candidates.filter(
    (candidate) =>
      uncertainBeforeAgeCorroboration(candidate, "dateOfBirth") &&
      studentScanAgeCorroborated(candidate, referenceDate),
  ).length

  return {
    readPhone,
    nameOrderAnswered: order,
    automaticNameOrderApplied:
      !order && useAutomaticInference ? selectedOrder : null,
    nameOrderInference: inference,
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
    rowsToReviewBeforeAgeCorroboration: candidates.filter(
      (candidate) =>
        !candidate.firstName.trim() ||
        !candidate.surname.trim() ||
        !candidate.dateOfBirth ||
        !candidate.sex ||
        orderUndecided(candidate) ||
        fields.some((field) =>
          uncertainBeforeAgeCorroboration(candidate, field),
        ),
    ).length,
    // The three causes, separately, because they are three different fixes.
    missingFields,
    lowConfidenceFields,
    lowConfidenceFieldsBeforeAgeCorroboration,
    corroboratedDates,
    lowConfidenceByField: Object.fromEntries(
      fields.map((field) => [
        field,
        candidates.filter((candidate) => uncertain(candidate, field)).length,
      ]),
    ),
    unresolvedNameOrder: candidates.filter(orderUndecided).length,
    fieldsFlagged: missingFields + lowConfidenceFields,
    fieldsFlaggedBeforeAgeCorroboration:
      missingFields + lowConfidenceFieldsBeforeAgeCorroboration,
  }
}

const measurement = {
  image: relative(root, imagePath).replaceAll("\\", "/"),
  measuredAt: new Date().toISOString(),
  runtime: process.version,
  crop: cropFractions ? { fractions: cropFractions, pixels: rectangle } : null,
  recognitionMs,
  referenceDate,
  minFieldConfidence: MIN_FIELD_CONFIDENCE,
  beforeAutomaticNameOrder: {
    withTelephone: audit(true, null, false),
    withoutTelephone: audit(false, null, false),
  },
  withTelephone: audit(true),
  withoutTelephone: audit(false),
  // What the operator is actually left with: the telephone off, which is now
  // the default, and the one name-order question answered.
  afterTheNameOrderAnswer: nameOrder
    ? {
        withTelephone: audit(true, nameOrder),
        withoutTelephone: audit(false, nameOrder),
      }
    : null,
}

const report = JSON.stringify(measurement, null, 2)
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${report}\n`, "utf8")
}
console.log(report)
