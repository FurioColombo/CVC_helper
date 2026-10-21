import { describe, expect, it } from "vitest"

import {
  addedLines,
  isRecordPath,
  lineProblems,
  parseDenylist,
  pathProblem,
} from "./privacy-rules.mjs"

describe("pathProblem", () => {
  it.each([
    "data/private/ocr-owner/photo-1.jpg",
    "backup/cvc-helper.db",
    "exports/course.sqlite",
    "cvc-helper.db-wal",
    "supabase/seed.dump",
    "logs/session.jsonl",
    "capture.har",
    ".env",
    ".env.local",
    "supabase/.env.production",
    "certs/server.pem",
  ])("refuses %s", (path) => {
    expect(pathProblem(path)).not.toBeNull()
  })

  it.each([
    ".env.example",
    "src/persistence/db.ts",
    "docs/DATA.md",
    "tests/fixtures/ocr-sheet-clear.png",
    "metadata/environment.ts",
  ])("allows %s", (path) => {
    expect(pathProblem(path)).toBeNull()
  })
})

describe("lineProblems", () => {
  // Every sample is assembled at run time: written out whole, this file would
  // be refused by the very hook it tests.
  it("refuses keys and passwords in any file", () => {
    const jwt = [
      "eyJhbGciOiJIUzI1NiJ9",
      "eyJyb2xlIjoic2VydmljZSJ9",
      "c2lnbmF0dXJlLXZhbHVl",
    ].join(".")
    for (const line of [
      ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
      `const key = "${jwt}"`,
      `${"SUPABASE_SERVICE_ROLE"}_KEY=abcdefghijklmnop`,
      `url: ${["postgres://admin:hunter22", "db.example.com:5432/app"].join("@")}`,
      `token: ${"sb_secret_"}abcdefghijklmnop`,
    ]) {
      expect(lineProblems("src/lib/sync.ts", line)).not.toEqual([])
    }
  })

  it("allows placeholders and environment references", () => {
    for (const line of [
      "SUPABASE_SERVICE_ROLE_KEY=",
      "PS_DATABASE_PASSWORD=${PS_DATABASE_PASSWORD}",
      "const url = import.meta.env.VITE_POWERSYNC_URL",
      "postgres://localhost:5432/app",
    ]) {
      expect(lineProblems("src/lib/sync.ts", line)).toEqual([])
    }
  })

  it("refuses an unknown phone number only in records", () => {
    const line = "Allievo letto con telefono 347 555 0199"
    expect(isRecordPath(".evidence/F9/review.json")).toBe(true)
    expect(lineProblems(".evidence/F9/review.json", line)).not.toEqual([])
    expect(lineProblems("docs/post-mvp/NOTES.md", line)).not.toEqual([])
    expect(lineProblems("README.md", line)).not.toEqual([])
    expect(lineProblems("src/capabilities/studentScan.test.ts", line)).toEqual(
      [],
    )
  })

  it("treats a bare JSON number as a number, but a phone string as a phone", () => {
    expect(
      lineProblems(".evidence/H1/review.json", '    "seed": 349189509,'),
    ).toEqual([])
    expect(
      lineProblems(".evidence/H1/review.json", '"bytes": 3471234567}'),
    ).toEqual([])
    expect(
      lineProblems(".evidence/H1/review.json", '"phone": "347 555 0199",'),
    ).not.toEqual([])
    expect(
      lineProblems(".evidence/H1/review.json", '"note": 3475550199 rows'),
    ).not.toEqual([])
  })

  it("allows fractional JSON metrics while refusing phone strings and prose", () => {
    expect(
      lineProblems(".evidence/T1/timing.json", '"duration": 350689.983,'),
    ).toEqual([])
    for (const line of [
      '"phone": "350689.983",',
      '"note": 350689.983 ms',
      '"phone": 347.555.0199,',
    ]) {
      expect(lineProblems(".evidence/T1/timing.json", line)).not.toEqual([])
    }
  })

  it("treats a quoted exit code as a code, but not a phone after other words", () => {
    expect(
      lineProblems(
        ".evidence/D2/review.json",
        "'worker process exited unexpectedly (code=3221226505, signal=null)'",
      ),
    ).toEqual([])
    expect(
      lineProblems(".evidence/D2/review.json", "exit code 3221226505"),
    ).toEqual([])
    expect(
      lineProblems(
        ".evidence/D2/review.json",
        '"reproduction": "differential.test.ts (seed 301134364): no differences"',
      ),
    ).toEqual([])
    expect(
      lineProblems(".evidence/D2/review.json", "call 3221226505 tonight"),
    ).not.toEqual([])
  })

  it("allows the synthetic fixture numbers and hashes in records", () => {
    for (const line of [
      "test for 'Personale tel. 3331234567' before 'Allievi'",
      "+39 333 1234567 and 320 555 0142",
      '"before": "8e9b2b79f5275f4c881f5751c1fbbee322271633"',
      "sourceDigest 3a1f3471234567ab",
    ]) {
      expect(lineProblems(".evidence/F9/review.json", line)).toEqual([])
    }
  })

  it("refuses denylisted words as whole words, in any case", () => {
    const denylist = parseDenylist("# private\nVeldorsky\n\nab\n3471112233\n")
    expect(denylist).toEqual(["veldorsky", "3471112233"])
    expect(lineProblems("src/a.test.ts", "Mario VELDORSKY", denylist)).toEqual([
      "a name or number from the private denylist",
    ])
    expect(lineProblems("src/a.ts", "tel 3471112233", denylist)).not.toEqual([])
    expect(lineProblems("src/a.ts", "Veldorskyani", denylist)).toEqual([])
  })

  it("never repeats the matched text in its reasons", () => {
    const denylist = parseDenylist("Veldorsky")
    const reasons = lineProblems(
      "docs/x.md",
      "Veldorsky 347 555 0199",
      denylist,
    ).join(" ")
    expect(reasons).not.toMatch(/veldorsky|347/i)
  })
})

describe("addedLines with an awkward path", () => {
  it("drops the TAB git puts after a path with a space, so the record rules apply", () => {
    const diff = [
      "--- /dev/null",
      "+++ b/Owner Notes.md\t",
      "@@ -0,0 +1 @@",
      "+contatto 347 555 0199",
    ].join("\n")
    const [[path, lines]] = [...addedLines(diff)]
    expect(path).toBe("Owner Notes.md")
    expect(lineProblems(path, lines[0].text)).not.toEqual([])
  })
})

describe("addedLines", () => {
  it("collects added lines with their numbers, per file", () => {
    const diff = [
      "diff --git a/docs/a.md b/docs/a.md",
      "--- a/docs/a.md",
      "+++ b/docs/a.md",
      "@@ -3,0 +4,2 @@",
      "+first",
      "++++ an added line starting with three pluses",
      "diff --git a/old.md b/old.md",
      "--- a/old.md",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
    ].join("\n")
    expect([...addedLines(diff)]).toEqual([
      [
        "docs/a.md",
        [
          { lineNumber: 4, text: "first" },
          {
            lineNumber: 5,
            text: "+++ an added line starting with three pluses",
          },
        ],
      ],
    ])
  })
})

describe("phone formats the roster reader accepts (UG3 review SP-UG3-2)", () => {
  const unknown = [
    "(347) 1234567",
    "347/1234567",
    "347 12 34 567",
    "347-123-4567",
  ]
  it("refuses each grouping of an unknown number in evidence and owner records", () => {
    for (const phone of unknown) {
      expect(
        lineProblems(".evidence/X/a.json", `"phone": "${phone}"`),
      ).not.toEqual([])
      expect(
        lineProblems(".milestones/owner-checks.json", `call ${phone}`),
      ).not.toEqual([])
    }
  })
  it("keeps viewport width lists and the synthetic fixtures allowed", () => {
    expect(lineProblems(".evidence/X/a.json", "at 390/360/320 px")).toEqual([])
    expect(
      lineProblems(".evidence/X/a.json", '"phone": "333 123 4567"'),
    ).toEqual([])
  })
})
