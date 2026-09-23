import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { createWorker, OEM, PSM } from "tesseract.js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  applyStudentNameOrder,
  extractStudentCandidates,
  MIN_FIELD_CONFIDENCE,
  studentScanAgeCorroborated,
  TESSERACT_USER_DEFINED_DPI,
  type StudentScanCandidate,
  type StudentScanField,
} from "@/capabilities/studentScan"

interface SyntheticPerson {
  id: string
  printedName: string
  firstName: string
  surname: string
  dateOfBirth: string
  age: number
  phone: string
  ambiguousCompound?: boolean
}

interface SyntheticVariant {
  file: string
  rotationDegrees: number
  lighting: string
  rowRules: boolean
  layout: string
  columnFragmentationExpected: boolean
  people: SyntheticPerson[]
}

interface SyntheticTruth {
  schemaVersion: 1
  synthetic: true
  referenceDate: string
  printedNameOrder: "surname-given"
  requiredFields: StudentScanField[]
  readableFields: string[]
  expectedAmbiguousNameIds: string[]
  variants: SyntheticVariant[]
}

interface ImageMeasurement {
  file: string
  expectedRows: number
  candidateRows: number
  falseRows: number
  falseRowsWithoutReview: number
  missingRows: number
  duplicateRows: number
  identityConflicts: number
  missingFields: number
  fieldReviewFlags: number
  rowsToReview: number
  ambiguousNameRows: number
  correctReadableFields: number
  readableFields: number
  fieldAccuracy: number
  fields: Record<string, { correct: number; total: number }>
}

const fixtureDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "ocr-synthetic",
)
const reviewedFields: StudentScanField[] = [
  "firstName",
  "surname",
  "dateOfBirth",
  "phone",
]

function normalizedText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/\s+/g, " ")
    .trim()
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

function tsvLines(tsv: string) {
  const lines = new Map<string, { id: string; text: string[]; top: number }>()
  const rows = tsv.trim().split(/\r?\n/).slice(1)

  for (const row of rows) {
    const columns = row.split("\t")
    if (columns[0] !== "5" || !columns[11]?.trim()) continue
    const id = columns.slice(1, 5).join(":")
    const top = Number(columns[7])
    const line = lines.get(id) ?? { id, text: [], top }
    line.text.push(columns[11].trim())
    line.top = Math.min(line.top, top)
    lines.set(id, line)
  }

  return [...lines.values()].map((line) => ({
    id: line.id,
    text: line.text.join(" "),
    top: line.top,
  }))
}

function assertWideColumnAnchors(tsv: string, people: SyntheticPerson[]) {
  const lines = tsvLines(tsv)
  const nameAnchors = new Set<string>()
  const rows: Array<{
    personId: string
    nameTop: number
    phoneTop: number
    dateTop: number
  }> = []

  for (const person of people) {
    const nameMatches = lines.filter((line) =>
      normalizedText(line.text).includes(normalizedText(person.printedName)),
    )
    const phoneMatches = lines.filter(
      (line) => digits(line.text) === digits(person.phone),
    )
    const birthDate = person.dateOfBirth.split("-").reverse().join("/")
    const dateMatches = lines.filter(
      (line) => digits(line.text) === digits(birthDate),
    )

    expect(nameMatches, `${person.id} unique name TSV line`).toHaveLength(1)
    expect(phoneMatches, `${person.id} unique phone TSV line`).toHaveLength(1)
    expect(dateMatches, `${person.id} unique DOB TSV line`).toHaveLength(1)

    const [name] = nameMatches
    const [phone] = phoneMatches
    const [date] = dateMatches
    expect(name).toBeDefined()
    expect(phone).toBeDefined()
    expect(date).toBeDefined()
    expect(
      new Set([name!.id, phone!.id, date!.id]).size,
      `${person.id} fields occupy distinct Tesseract lines`,
    ).toBe(3)
    expect(
      Math.max(name!.top, phone!.top, date!.top) -
        Math.min(name!.top, phone!.top, date!.top),
      `${person.id} name/phone/DOB y alignment`,
    ).toBeLessThanOrEqual(18)
    expect(
      nameAnchors.has(name!.id),
      `${person.id} unique name row anchor`,
    ).toBe(false)
    nameAnchors.add(name!.id)
    rows.push({
      personId: person.id,
      nameTop: name!.top,
      phoneTop: phone!.top,
      dateTop: date!.top,
    })
  }

  const nameTops = rows.map((row) => row.nameTop)
  expect(new Set(nameTops).size).toBe(people.length)
  expect(nameTops, "name y anchors retain roster order").toEqual(
    [...nameTops].sort((left, right) => left - right),
  )

  for (const row of rows) {
    for (const [field, top] of [
      ["phone", row.phoneTop],
      ["DOB", row.dateTop],
    ] as const) {
      const alignedNames = rows.filter(
        (candidate) => Math.abs(candidate.nameTop - top) <= 18,
      )
      expect(
        alignedNames,
        `${row.personId} ${field} has one name row`,
      ).toHaveLength(1)
      expect(alignedNames[0]?.personId).toBe(row.personId)
    }
  }
}

function rawName(candidate: StudentScanCandidate) {
  return (
    candidate.nameReading?.raw ??
    [candidate.firstName, candidate.surname].filter(Boolean).join(" ")
  )
}

function associateCandidate(
  candidate: StudentScanCandidate,
  people: SyntheticPerson[],
) {
  const evidence: SyntheticPerson[] = []
  const text = normalizedText(rawName(candidate))
  const date = candidate.dateOfBirth
  const phone = digits(candidate.phone)
  const evidenceMatches = [
    text
      ? people.filter((person) => normalizedText(person.printedName) === text)
      : [],
    date ? people.filter((person) => person.dateOfBirth === date) : [],
    phone ? people.filter((person) => digits(person.phone) === phone) : [],
  ]

  for (const matches of evidenceMatches) {
    if (matches.length === 1) evidence.push(matches[0]!)
  }

  const evidenceIds = new Set(evidence.map(({ id }) => id))
  if (evidenceIds.size > 1) {
    return { person: undefined, identityConflict: true }
  }
  if (evidence.length < 2 || evidenceIds.size !== 1) {
    return { person: undefined, identityConflict: false }
  }
  return { person: evidence[0], identityConflict: false }
}

function candidateFieldNeedsReview(
  candidate: StudentScanCandidate,
  field: StudentScanField,
  referenceDate: string,
) {
  if (field === "phone" && !candidate.phone.trim()) return false
  if (
    field === "dateOfBirth" &&
    studentScanAgeCorroborated(candidate, referenceDate)
  ) {
    return false
  }
  return candidate.confidence[field] < MIN_FIELD_CONFIDENCE
}

function candidateNeedsRowReview(
  candidate: StudentScanCandidate,
  referenceDate: string,
) {
  const unresolvedName = Boolean(
    candidate.nameReading &&
    (candidate.nameReading.order === "unknown" ||
      (candidate.nameReading.compoundAmbiguity &&
        !candidate.nameReading.acknowledged)),
  )
  const ageMismatch = Boolean(
    candidate.ageReading &&
    candidate.dateOfBirth &&
    !studentScanAgeCorroborated(candidate, referenceDate),
  )
  return (
    !candidate.firstName.trim() ||
    !candidate.surname.trim() ||
    !candidate.dateOfBirth ||
    !candidate.sex ||
    unresolvedName ||
    ageMismatch ||
    reviewedFields.some((field) =>
      candidateFieldNeedsReview(candidate, field, referenceDate),
    )
  )
}

async function readTruth() {
  const serialized = await readFile(
    path.join(fixtureDirectory, "truth.json"),
    "utf8",
  )
  return JSON.parse(serialized) as SyntheticTruth
}

function emptyFieldCounts() {
  return {
    printedName: { correct: 0, total: 0 },
    firstName: { correct: 0, total: 0 },
    surname: { correct: 0, total: 0 },
    dateOfBirth: { correct: 0, total: 0 },
    age: { correct: 0, total: 0 },
    phone: { correct: 0, total: 0 },
  }
}

function countField(
  fields: ReturnType<typeof emptyFieldCounts>,
  field: keyof ReturnType<typeof emptyFieldCounts>,
  correct: boolean,
) {
  fields[field].total += 1
  fields[field].correct += Number(correct)
}

function measureImage(
  file: string,
  candidates: StudentScanCandidate[],
  people: SyntheticPerson[],
  referenceDate: string,
): ImageMeasurement {
  const assigned = new Map<string, StudentScanCandidate>()
  let falseRows = 0
  let falseRowsWithoutReview = 0
  let duplicateRows = 0
  let identityConflicts = 0

  for (const candidate of candidates) {
    const { person, identityConflict } = associateCandidate(candidate, people)
    if (!person) {
      falseRows += 1
      falseRowsWithoutReview += Number(
        !candidateNeedsRowReview(candidate, referenceDate),
      )
      identityConflicts += Number(identityConflict)
      continue
    }
    if (assigned.has(person.id)) {
      falseRows += 1
      falseRowsWithoutReview += Number(
        !candidateNeedsRowReview(candidate, referenceDate),
      )
      duplicateRows += 1
      identityConflicts += Number(identityConflict)
      continue
    }
    assigned.set(person.id, candidate)
  }

  const fields = emptyFieldCounts()
  let missingFields = 0
  for (const person of people) {
    const candidate = assigned.get(person.id)
    if (!candidate) {
      countField(
        fields,
        person.ambiguousCompound ? "printedName" : "firstName",
        false,
      )
      if (!person.ambiguousCompound) countField(fields, "surname", false)
      countField(fields, "dateOfBirth", false)
      countField(fields, "age", false)
      countField(fields, "phone", false)
      missingFields += 5
      continue
    }

    const recognizedRawName = normalizedText(rawName(candidate))
    if (person.ambiguousCompound) {
      countField(
        fields,
        "printedName",
        recognizedRawName === normalizedText(person.printedName),
      )
    } else {
      countField(
        fields,
        "firstName",
        normalizedText(candidate.firstName) ===
          normalizedText(person.firstName),
      )
      countField(
        fields,
        "surname",
        normalizedText(candidate.surname) === normalizedText(person.surname),
      )
    }
    countField(
      fields,
      "dateOfBirth",
      candidate.dateOfBirth === person.dateOfBirth,
    )
    countField(fields, "age", candidate.ageReading?.value === person.age)
    countField(
      fields,
      "phone",
      digits(candidate.phone) === digits(person.phone),
    )
    missingFields += Number(!candidate.firstName.trim())
    missingFields += Number(!candidate.surname.trim())
    missingFields += Number(!candidate.dateOfBirth)
    missingFields += Number(candidate.ageReading === undefined)
    missingFields += Number(!candidate.phone.trim())
  }

  const mappedCandidates = [...assigned.values()]
  const missingRows = people.length - assigned.size
  const expectedAmbiguousRows = mappedCandidates.filter(
    (candidate) => candidate.nameReading?.compoundAmbiguity,
  ).length
  const fieldReviewFlags = candidates.reduce(
    (total, candidate) =>
      total +
      reviewedFields.filter((field) =>
        candidateFieldNeedsReview(candidate, field, referenceDate),
      ).length,
    0,
  )
  const rowsToReview = candidates.filter((candidate) =>
    candidateNeedsRowReview(candidate, referenceDate),
  ).length
  const correctReadableFields = Object.values(fields).reduce(
    (total, field) => total + field.correct,
    0,
  )
  const readableFields = Object.values(fields).reduce(
    (total, field) => total + field.total,
    0,
  )

  return {
    file,
    expectedRows: people.length,
    candidateRows: candidates.length,
    falseRows,
    falseRowsWithoutReview,
    missingRows,
    duplicateRows,
    identityConflicts,
    missingFields,
    fieldReviewFlags,
    rowsToReview,
    ambiguousNameRows: expectedAmbiguousRows,
    correctReadableFields,
    readableFields,
    fieldAccuracy:
      readableFields === 0 ? 1 : correctReadableFields / readableFields,
    fields,
  }
}

describe("synthetic roster OCR regression", () => {
  let worker: Awaited<ReturnType<typeof createWorker>>

  beforeAll(async () => {
    worker = await createWorker("ita", OEM.LSTM_ONLY, {
      corePath: "node_modules/tesseract.js-core",
      langPath: "node_modules/@tesseract.js-data/ita/4.0.0_best_int",
      logger: () => {},
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      user_defined_dpi: String(TESSERACT_USER_DEFINED_DPI),
    })
  }, 30_000)

  afterAll(async () => {
    await worker?.terminate()
  })

  it("keeps readable fields with the right person and measures false rows, missing rows, and review flags", async () => {
    const truth = await readTruth()
    expect(truth.synthetic).toBe(true)
    expect(truth.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(truth.readableFields).toContain("age")
    expect(truth.variants).toHaveLength(4)
    expect(truth.variants.every((variant) => variant.rowRules)).toBe(true)
    expect(
      truth.variants.every(
        (variant) => Math.abs(variant.rotationDegrees) <= 1.1,
      ),
    ).toBe(true)
    expect(MIN_FIELD_CONFIDENCE).toBe(70)
    expect(TESSERACT_USER_DEFINED_DPI).toBe(180)

    const measurements: ImageMeasurement[] = []
    const mappedByImage = new Map<string, Map<string, StudentScanCandidate>>()

    for (const variant of truth.variants) {
      const bytes = await readFile(path.join(fixtureDirectory, variant.file))
      const { data } = await worker.recognize(
        bytes,
        { rotateAuto: true },
        { text: true, tsv: true },
      )
      if (variant.columnFragmentationExpected) {
        expect(variant.layout).toBe("wide-columns")
        if (typeof data.tsv !== "string") {
          throw new Error(`${variant.file} is missing Tesseract TSV output`)
        }
        assertWideColumnAnchors(data.tsv, variant.people)
      }
      const extracted = extractStudentCandidates(data, { readPhone: true })
      const orderedCandidates = extracted.candidates.map((candidate) =>
        applyStudentNameOrder(candidate, truth.printedNameOrder),
      )
      const byPerson = new Map<string, StudentScanCandidate>()
      for (const candidate of orderedCandidates) {
        const { person } = associateCandidate(candidate, variant.people)
        if (person && !byPerson.has(person.id))
          byPerson.set(person.id, candidate)
      }
      mappedByImage.set(variant.file, byPerson)
      measurements.push(
        measureImage(
          variant.file,
          orderedCandidates,
          variant.people,
          truth.referenceDate,
        ),
      )
    }

    const aggregate = measurements.reduce(
      (total, measurement) => ({
        expectedRows: total.expectedRows + measurement.expectedRows,
        candidateRows: total.candidateRows + measurement.candidateRows,
        falseRows: total.falseRows + measurement.falseRows,
        falseRowsWithoutReview:
          total.falseRowsWithoutReview + measurement.falseRowsWithoutReview,
        missingRows: total.missingRows + measurement.missingRows,
        duplicateRows: total.duplicateRows + measurement.duplicateRows,
        identityConflicts:
          total.identityConflicts + measurement.identityConflicts,
        missingFields: total.missingFields + measurement.missingFields,
        fieldReviewFlags: total.fieldReviewFlags + measurement.fieldReviewFlags,
        rowsToReview: total.rowsToReview + measurement.rowsToReview,
        correctReadableFields:
          total.correctReadableFields + measurement.correctReadableFields,
        readableFields: total.readableFields + measurement.readableFields,
      }),
      {
        expectedRows: 0,
        candidateRows: 0,
        falseRows: 0,
        falseRowsWithoutReview: 0,
        missingRows: 0,
        duplicateRows: 0,
        identityConflicts: 0,
        missingFields: 0,
        fieldReviewFlags: 0,
        rowsToReview: 0,
        correctReadableFields: 0,
        readableFields: 0,
      },
    )
    const accuracy =
      aggregate.readableFields === 0
        ? 1
        : aggregate.correctReadableFields / aggregate.readableFields

    console.info(
      "Synthetic OCR measurements:",
      JSON.stringify({
        perImage: measurements.map((measurement) => ({
          file: measurement.file,
          expectedRows: measurement.expectedRows,
          candidateRows: measurement.candidateRows,
          falseRows: measurement.falseRows,
          missingRows: measurement.missingRows,
          duplicateRows: measurement.duplicateRows,
          identityConflicts: measurement.identityConflicts,
          missingFields: measurement.missingFields,
          fieldReviewFlags: measurement.fieldReviewFlags,
          rowsToReview: measurement.rowsToReview,
          correctReadableFields: measurement.correctReadableFields,
          readableFields: measurement.readableFields,
          fieldAccuracy: measurement.fieldAccuracy,
        })),
        aggregate: { ...aggregate, fieldAccuracy: accuracy },
      }),
    )

    for (const measurement of measurements) {
      // Visible captions can become removable candidate rows. They must never
      // be counted as real people or silently pass through review.
      expect(
        measurement.falseRows,
        `${measurement.file} false rows`,
      ).toBeLessThanOrEqual(2)
      expect(
        measurement.falseRowsWithoutReview,
        `${measurement.file} false rows without review`,
      ).toBe(0)
      expect(measurement.missingRows, `${measurement.file} missing rows`).toBe(
        0,
      )
      expect(
        measurement.duplicateRows,
        `${measurement.file} duplicate associations`,
      ).toBe(0)
      expect(
        measurement.identityConflicts,
        `${measurement.file} identity conflicts`,
      ).toBe(0)
      expect(
        measurement.fieldAccuracy,
        `${measurement.file} readable field accuracy`,
      ).toBeGreaterThanOrEqual(0.9)
      expect(
        measurement.fieldReviewFlags,
        `${measurement.file} field review flags`,
      ).toBeLessThan(5)
      expect(
        measurement.rowsToReview,
        `${measurement.file} rows to review`,
      ).toBeLessThan(5)
    }

    expect(aggregate.falseRows).toBeLessThanOrEqual(8)
    expect(aggregate.falseRowsWithoutReview).toBe(0)
    expect(aggregate.missingRows).toBe(0)
    expect(aggregate.duplicateRows).toBe(0)
    expect(aggregate.identityConflicts).toBe(0)
    expect(aggregate.missingFields).toBe(0)
    expect(accuracy).toBeGreaterThanOrEqual(0.9)
    expect(aggregate.rowsToReview).toBeGreaterThanOrEqual(
      truth.expectedAmbiguousNameIds.length * truth.variants.length,
    )

    for (const variant of truth.variants) {
      const byPerson = mappedByImage.get(variant.file)
      for (const personId of truth.expectedAmbiguousNameIds) {
        const expectedPerson = variant.people.find(({ id }) => id === personId)
        const candidate = byPerson?.get(personId)
        expect(expectedPerson).toBeDefined()
        expect(candidate?.nameReading?.raw).toBe(expectedPerson?.printedName)
        expect(candidate?.nameReading?.compoundAmbiguity).toBe(true)
        expect(candidate?.nameReading?.acknowledged).toBe(false)
      }
    }
  }, 60_000)

  it("does not let a wrong phone reassociate a row with another person", async () => {
    const truth = await readTruth()
    const firstVariant = truth.variants[0]!
    const [firstPerson, secondPerson] = firstVariant.people
    expect(firstPerson).toBeDefined()
    expect(secondPerson).toBeDefined()

    const conflictingCandidate: StudentScanCandidate = {
      sourceId: "conflict-row",
      firstName: firstPerson!.printedName.split(" ").at(-1)!,
      surname: firstPerson!.printedName.split(" ").slice(0, -1).join(" "),
      dateOfBirth: firstPerson!.dateOfBirth,
      phone: secondPerson!.phone,
      sex: "female",
      confidence: {
        firstName: 95,
        surname: 95,
        dateOfBirth: 95,
        phone: 95,
      },
      nameReading: {
        raw: firstPerson!.printedName,
        words: firstPerson!.printedName
          .split(" ")
          .map((text) => ({ text, confidence: 95 })),
        order: truth.printedNameOrder,
        compoundAmbiguity: false,
        acknowledged: false,
      },
    }

    const measurement = measureImage(
      "wrong-phone-collision",
      [conflictingCandidate],
      firstVariant.people,
      truth.referenceDate,
    )

    expect(measurement.identityConflicts).toBe(1)
    expect(measurement.falseRows).toBe(1)
    expect(measurement.missingRows).toBe(firstVariant.people.length)
    expect(measurement.duplicateRows).toBe(0)
  })
})
