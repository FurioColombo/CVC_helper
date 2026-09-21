import { readFile } from "node:fs/promises"
import { basename } from "node:path"

import { createWorker, OEM, PSM } from "tesseract.js"
import { extractStudentCandidates } from "../src/capabilities/studentScan.ts"

const inputPaths = process.argv.slice(2)
if (inputPaths.length === 0) {
  throw new Error("Pass one or more image paths")
}

const worker = await createWorker("ita", OEM.LSTM_ONLY, {
  corePath: "node_modules/tesseract.js-core",
  langPath: "node_modules/@tesseract.js-data/ita/4.0.0_best_int",
  logger: () => {},
})
await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })

function fieldPresence(candidate) {
  return {
    firstName: Boolean(candidate.firstName),
    surname: Boolean(candidate.surname),
    dateOfBirth: Boolean(candidate.dateOfBirth),
    phone: Boolean(candidate.phone),
  }
}

function summarize(path, data) {
  const result = extractStudentCandidates(data)
  if (process.env.SHOW_RAW === "1") {
    console.log(
      JSON.stringify({
        file: basename(path),
        candidates: result.candidates.map((candidate) => ({
          firstName: candidate.firstName,
          surname: candidate.surname,
          dateOfBirth: Boolean(candidate.dateOfBirth),
          phone: Boolean(candidate.phone),
          confidence: candidate.confidence,
        })),
      }),
    )
  }
  const fields = result.candidates.map(fieldPresence)
  const counts = Object.fromEntries(
    Object.keys(
      fields[0] ?? {
        firstName: false,
        surname: false,
        dateOfBirth: false,
        phone: false,
      },
    ).map((key) => [key, fields.filter((row) => row[key]).length]),
  )
  const structuralRows = fields.filter(
    (row) => row.firstName && row.surname,
  ).length
  const completeRows = fields.filter(
    (row) => row.firstName && row.surname && row.dateOfBirth && row.phone,
  ).length
  const weakRows = fields.filter(
    (row) =>
      (row.firstName ? 1 : 0) +
        (row.surname ? 1 : 0) +
        (row.dateOfBirth ? 1 : 0) +
        (row.phone ? 1 : 0) <
      2,
  ).length
  const expectedStudentRows = basename(path).toLowerCase().includes("copy")
    ? 20
    : 20
  return {
    file: basename(path),
    bytes: data._bytes,
    pageConfidence: data.confidence,
    ocrLineCount: data.text.split(/\r?\n/).filter((line) => line.trim()).length,
    candidateCount: result.candidates.length,
    expectedStudentRows,
    candidateRowCountError: result.candidates.length - expectedStudentRows,
    unsuitable: result.unsuitable,
    fieldsPresent: counts,
    structuralNameRows: structuralRows,
    completeRows,
    weakRows,
    lowConfidenceFields: result.candidates.reduce(
      (total, candidate) =>
        total +
        Object.values(candidate.confidence).filter(
          (confidence) => confidence > 0 && confidence < 70,
        ).length,
      0,
    ),
    candidateFieldPresence: fields,
  }
}

const summaries = []
for (const path of inputPaths) {
  const bytes = await readFile(path)
  const started = Date.now()
  const data = await worker.recognize(
    bytes,
    { rotateAuto: true },
    { text: true, tsv: true },
  )
  summaries.push(
    summarize(path, {
      ...data.data,
      _bytes: bytes.byteLength,
      _elapsedMs: Date.now() - started,
    }),
  )
}

await worker.terminate()
console.log(JSON.stringify(summaries, null, 2))
