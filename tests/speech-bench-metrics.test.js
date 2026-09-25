import { describe, expect, it, vi } from "vitest"
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildRoundSchedule,
  loopRate,
  median,
  medianPerClipLatency,
  rotateRoundGroups,
} from "../scripts/speech-bench/metrics.mjs"
import { resolve } from "node:path"
import {
  isAllowedBenchmarkResultPath,
  isPathWithinDirectory,
  resolveBenchmarkOutputPath,
  toGitPathspec,
  writeBenchmarkResultsSafely,
} from "../scripts/speech-bench/result-path.mjs"

describe("speech benchmark metrics", () => {
  it("computes medians for odd and even repeated samples", () => {
    expect(median([18, 11, 14])).toBe(14)
    expect(median([18, 11, 14, 16])).toBe(15)
    expect(median([])).toBe(0)
  })

  it("summarizes latency by taking the median of per-clip medians", () => {
    expect(
      medianPerClipLatency([
        { medianWarmLatencyMs: 120 },
        { medianWarmLatencyMs: 80 },
        { medianWarmLatencyMs: 100 },
      ]),
    ).toBe(100)
    expect(medianPerClipLatency([])).toBeNull()
  })

  it("counts whitespace-separated repetition loops above the 3x threshold", () => {
    expect(
      loopRate([
        { hypothesis: "uno due tre quattro cinque sei sette", words: 2 },
        { hypothesis: "uno due tre quattro cinque sei", words: 2 },
      ]),
    ).toBe("50")
    expect(loopRate([])).toBe("n/a")
  })

  it("matches every variant with every clip and rotates their run order", () => {
    const variants = [
      { variant: "a", variantIndex: 0 },
      { variant: "b", variantIndex: 1 },
      { variant: "c", variantIndex: 2 },
    ]
    const entries = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const rounds = [0, 1, 2].map((round) =>
      buildRoundSchedule(variants, entries, round),
    )

    for (const round of rounds) {
      expect(round).toHaveLength(entries.length)
      for (const clip of round) {
        expect(clip.variants.map((item) => item.variant)).toEqual(
          expect.arrayContaining(variants.map((item) => item.variant)),
        )
        expect(clip.variants).toHaveLength(variants.length)
      }
    }

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const firstVariants = rounds.map(
        (round) =>
          round.find((clip) => clip.entryIndex === entryIndex).variants[0]
            .variant,
      )
      expect(new Set(firstVariants)).toEqual(
        new Set(variants.map((item) => item.variant)),
      )
    }

    expect(rounds[0][0].entryIndex).toBe(0)
    expect(rounds[1][0].entryIndex).toBe(1)
    expect(rounds[2][0].entryIndex).toBe(2)
  })

  it("rotates model groups between repeated rounds", () => {
    const groups = [{ id: "base-q8" }, { id: "base-q4" }, { id: "tiny-q8" }]

    expect(
      [0, 1, 2].map((round) => rotateRoundGroups(groups, round)[0].id),
    ).toEqual(["base-q8", "base-q4", "tiny-q8"])
  })

  it("allows result files outside the repo or ignored by Git only", () => {
    const repositoryRoot = resolve("temporary-repository")
    const inside = resolve(repositoryRoot, "results.json")
    const outside = resolve(repositoryRoot, "..", "external", "results.json")

    expect(isPathWithinDirectory(inside, repositoryRoot)).toBe(true)
    expect(isPathWithinDirectory(outside, repositoryRoot)).toBe(false)
    expect(isAllowedBenchmarkResultPath(outside, repositoryRoot, false)).toBe(
      true,
    )
    expect(isAllowedBenchmarkResultPath(inside, repositoryRoot, true)).toBe(
      true,
    )
    expect(isAllowedBenchmarkResultPath(inside, repositoryRoot, false)).toBe(
      false,
    )
    expect(
      isAllowedBenchmarkResultPath(inside, repositoryRoot, true, true),
    ).toBe(false)
    expect(toGitPathspec("data\\private\\speech\\results.json")).toBe(
      "data/private/speech/results.json",
    )
  })

  it("refuses a dangling symlink and accepts an absent results file", () => {
    const candidate = "data/private/speech/results.json"
    const realpathSync = vi.fn(() => candidate)
    const symlinkFileSystem = {
      lstatSync: vi.fn(() => ({ isSymbolicLink: () => true })),
      realpathSync,
    }

    expect(() =>
      resolveBenchmarkOutputPath(candidate, symlinkFileSystem),
    ).toThrow("Refusing to write benchmark results through a symlink")
    expect(realpathSync).not.toHaveBeenCalled()

    expect(() =>
      resolveBenchmarkOutputPath(candidate, {
        lstatSync: vi.fn(() => ({
          isSymbolicLink: () => false,
          nlink: 2,
        })),
        realpathSync,
      }),
    ).toThrow("Refusing to write benchmark results through a hard link")

    const missingError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    })
    expect(
      resolveBenchmarkOutputPath(candidate, {
        lstatSync: vi.fn(() => {
          throw missingError
        }),
        realpathSync,
      }),
    ).toBe(candidate)
  })

  it("revalidates before atomic replacement and leaves the previous result intact on refusal", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "speech-bench-results-"),
    )
    const resultsPath = join(temporaryDirectory, "results.json")
    writeFileSync(resultsPath, "previous result")
    let validations = 0

    try {
      expect(() =>
        writeBenchmarkResultsSafely(resultsPath, "new result", () => {
          validations += 1
          if (validations === 1) return resultsPath
          throw new Error(
            "Refusing to write benchmark results through a symlink",
          )
        }),
      ).toThrow("Refusing to write benchmark results through a symlink")

      expect(validations).toBe(2)
      expect(readFileSync(resultsPath, "utf8")).toBe("previous result")
      expect(readdirSync(temporaryDirectory)).toEqual(["results.json"])
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })

  it("atomically replaces existing benchmark results after a successful final check", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "speech-bench-results-"),
    )
    const resultsPath = join(temporaryDirectory, "results.json")
    writeFileSync(resultsPath, "previous result")
    let validations = 0

    try {
      writeBenchmarkResultsSafely(resultsPath, "new result", () => {
        validations += 1
        return resultsPath
      })

      expect(validations).toBe(2)
      expect(readFileSync(resultsPath, "utf8")).toBe("new result")
      expect(readdirSync(temporaryDirectory)).toEqual(["results.json"])
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
