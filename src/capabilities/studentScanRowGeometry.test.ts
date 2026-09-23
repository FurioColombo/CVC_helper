import { describe, expect, it } from "vitest"
import { reconstructStudentScanTsvFragments } from "./studentScanRowGeometry"

interface TestWord {
  text: string
  confidence?: number
  left: number
  top: number
  width?: number
  height?: number
}

interface TestLine {
  page?: number
  block: number
  paragraph?: number
  line: number
  words: TestWord[]
}

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"

function tsvLine({ page = 1, block, paragraph = 1, line, words }: TestLine) {
  return words
    .map(
      ({ text, confidence = 91, left, top, width = 30, height = 20 }, index) =>
        `5\t${page}\t${block}\t${paragraph}\t${line}\t${index + 1}\t${left}\t${top}\t${width}\t${height}\t${confidence}\t${text}`,
    )
    .join("\n")
}

function page(...lines: TestLine[]) {
  return [HEADER, ...lines.map(tsvLine)].join("\n")
}

function rowsByText(tsv: string) {
  return tsv
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.split("\t"))
    .filter((cells) => cells[0] === "5")
    .map((cells) => ({
      text: cells[11] ?? "",
      sourceId: cells.slice(1, 5).join(":"),
      cells,
    }))
}

function sourceIdFor(tsv: string, text: string) {
  return rowsByText(tsv).find((row) => row.text === text)?.sourceId
}

function makeStudent(line: number, top: number, block = 1) {
  return {
    block,
    line,
    words: [
      { text: "Nurelia", confidence: 93, left: 100, top, width: 55 },
      { text: "Veldoro", confidence: 89, left: 165, top, width: 58 },
    ],
  } satisfies TestLine
}

function makeDate(block: number, line: number, top: number, left = 650) {
  return {
    block,
    line,
    words: [
      {
        text: "12/03/2008",
        confidence: 76,
        left,
        top,
        width: 105,
      },
    ],
  } satisfies TestLine
}

describe("reconstructStudentScanTsvFragments", () => {
  it("accepts Tesseract.js headerless TSV as well as fixture TSV", () => {
    const headerless = page(makeStudent(1, 100), makeDate(2, 1, 102))
      .split("\n")
      .slice(1)
      .join("\n")
    const result = reconstructStudentScanTsvFragments(headerless)
    expect(result.joins).toHaveLength(1)
    expect(result.unresolved).toHaveLength(0)
    expect(result.tsv.split("\n")).toHaveLength(headerless.split("\n").length)
    expect(result.tsv.startsWith("5\t")).toBe(true)
  })

  it("joins disjoint date, age and phone columns across TSV blocks and preserves word evidence", () => {
    const original = page(
      {
        block: 1,
        line: 1,
        words: [
          { text: "Mario", confidence: 96, left: 100, top: 100, width: 45 },
          { text: "Rossi", confidence: 93, left: 155, top: 100, width: 42 },
        ],
      },
      makeDate(2, 1, 102),
      {
        block: 3,
        line: 1,
        words: [
          {
            text: "età",
            confidence: 87,
            left: 500,
            top: 100,
            width: 26,
          },
          {
            text: "17",
            confidence: 85,
            left: 530,
            top: 100,
            width: 18,
          },
        ],
      },
      {
        block: 4,
        line: 1,
        words: [
          {
            text: "333",
            confidence: 88,
            left: 350,
            top: 100,
            width: 30,
          },
          {
            text: "123",
            confidence: 90,
            left: 383,
            top: 100,
            width: 30,
          },
          {
            text: "4567",
            confidence: 90,
            left: 416,
            top: 100,
            width: 37,
          },
        ],
      },
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toHaveLength(3)
    expect(result.joins.map(({ fields }) => fields)).toEqual([
      ["dateOfBirth"],
      ["age"],
      ["phone"],
    ])
    expect(result.unresolved).toEqual([])
    const target = sourceIdFor(result.tsv, "Mario")
    expect(target).toBe("1:1:1:1")
    expect(sourceIdFor(result.tsv, "Rossi")).toBe(target)
    for (const word of ["12/03/2008", "età", "17", "333", "123", "4567"]) {
      expect(sourceIdFor(result.tsv, word)).toBe(target)
    }

    const originalRows = rowsByText(original)
    const rewrittenRows = rowsByText(result.tsv)
    for (const { text, cells: originalCells } of originalRows) {
      const rewrittenCells = rewrittenRows.find(
        (row) => row.text === text,
      )?.cells
      expect(rewrittenCells).toBeDefined()
      // Group identity is the only rewritten TSV data. Text, confidence,
      // word ordering, and coordinates remain exactly as Tesseract returned.
      expect(
        rewrittenCells?.filter((_, index) => ![2, 3, 4].includes(index)),
      ).toEqual(originalCells.filter((_, index) => ![2, 3, 4].includes(index)))
    }
  })

  it("pairs adjacent rows by their own y anchors without crossing students", () => {
    const original = page(
      makeStudent(1, 100),
      makeStudent(2, 172),
      makeDate(2, 1, 101),
      makeDate(3, 1, 173),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toHaveLength(2)
    const dateRows = rowsByText(result.tsv).filter(
      ({ text }) => text === "12/03/2008",
    )
    expect(dateRows.map(({ sourceId }) => sourceId)).toEqual([
      "1:1:1:1",
      "1:1:1:2",
    ])
  })

  it("leaves a fragment near the boundary between adjacent rows unresolved", () => {
    const original = page(
      makeStudent(1, 100),
      makeStudent(2, 172),
      makeDate(2, 1, 136),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.tsv).toBe(original)
    expect(result.unresolved).toEqual([
      {
        sourceId: "1:2:1:1",
        fields: ["dateOfBirth"],
        reason: "no-unique-row",
      },
    ])
  })

  it("accepts a small systematic y offset from a skewed page", () => {
    const original = page(
      makeStudent(1, 244),
      makeStudent(2, 316),
      makeDate(2, 1, 250),
      makeDate(3, 1, 322),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toHaveLength(2)
    expect(result.unresolved).toEqual([])
    expect(
      rowsByText(result.tsv)
        .filter(({ text }) => text.includes("/"))
        .map(({ sourceId }) => sourceId),
    ).toEqual(["1:1:1:1", "1:1:1:2"])
  })

  it("does not choose between duplicate date fragments for one name row", () => {
    const original = page(
      makeStudent(1, 100),
      makeDate(2, 1, 100),
      makeDate(3, 1, 102),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.tsv).toBe(original)
    expect(result.unresolved).toHaveLength(2)
    expect(result.unresolved.map(({ reason }) => reason)).toEqual([
      "duplicate-field",
      "duplicate-field",
    ])
  })

  it("does not duplicate a date already present on the name row", () => {
    const original = page(
      {
        block: 1,
        line: 1,
        words: [
          { text: "Mario", confidence: 94, left: 100, top: 100, width: 45 },
          { text: "Rossi", confidence: 91, left: 155, top: 100, width: 42 },
          {
            text: "12/03/2008",
            confidence: 82,
            left: 650,
            top: 100,
            width: 105,
          },
        ],
      },
      makeDate(2, 1, 100),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.unresolved[0]?.reason).toBe("duplicate-field")
    expect(result.tsv).toBe(original)
  })

  it("leaves staff-row and footer readings separate", () => {
    const original = page(
      makeStudent(1, 100),
      {
        block: 2,
        line: 1,
        words: [{ text: "ADV", confidence: 94, left: 300, top: 100 }],
      },
      makeDate(3, 1, 100),
      {
        block: 4,
        line: 1,
        words: [
          { text: "Data", confidence: 91, left: 600, top: 980 },
          { text: "stampa", confidence: 91, left: 640, top: 980 },
          {
            text: "02/09/2026",
            confidence: 93,
            left: 710,
            top: 980,
            width: 105,
          },
        ],
      },
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.tsv).toBe(original)
    expect(result.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "staff-row" }),
        expect.objectContaining({ reason: "not-structured-only" }),
      ]),
    )
  })

  it("requires separate x columns even when the y anchor matches", () => {
    const original = page(
      {
        block: 1,
        line: 1,
        words: [
          { text: "Mario", confidence: 94, left: 100, top: 100, width: 60 },
          { text: "Rossi", confidence: 91, left: 170, top: 100, width: 70 },
        ],
      },
      makeDate(2, 1, 100, 220),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.unresolved[0]?.reason).toBe("overlapping-columns")
    expect(result.tsv).toBe(original)
  })

  it("reports a dense row band and geometric outliers without filtering any row", () => {
    const students = Array.from({ length: 10 }, (_, index) =>
      makeStudent(index + 1, 244 + index * 72),
    )
    const original = page(
      {
        block: 8,
        line: 1,
        words: [
          { text: "Programma", left: 80, top: 150 },
          { text: "Invernale", left: 145, top: 150 },
        ],
      },
      ...students,
      {
        block: 9,
        line: 1,
        words: [
          { text: "Office", left: 80, top: 980 },
          { text: "Contact", left: 130, top: 980 },
        ],
      },
      ...students.map((_, index) => makeDate(index + 10, 1, 244 + index * 72)),
    )

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.tableBand.supported).toBe(true)
    expect(result.tableBand.anchorSourceIds).toHaveLength(10)
    expect(result.tableBand.outsideSourceIds).toHaveLength(2)
    expect(result.tableBand.medianPitch).toBe(72)
    expect(rowsByText(result.tsv)).toHaveLength(rowsByText(original).length)
    expect(sourceIdFor(result.tsv, "Programma")).toBe("1:8:1:1")
    expect(sourceIdFor(result.tsv, "Office")).toBe("1:9:1:1")
  })

  it("leaves a bare numeric row-index-like fragment unclassified", () => {
    const original = page(makeStudent(1, 100), {
      block: 2,
      line: 1,
      words: [{ text: "17", confidence: 90, left: 530, top: 100 }],
    })

    const result = reconstructStudentScanTsvFragments(original)

    expect(result.joins).toEqual([])
    expect(result.unresolved).toEqual([])
    expect(result.tsv).toBe(original)
  })
})
