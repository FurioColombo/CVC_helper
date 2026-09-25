import { createRequire } from "node:module"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, realpathSync } from "node:fs"
import { join, relative } from "node:path"
import {
  buildRoundSchedule,
  loopRate,
  median,
  medianPerClipLatency,
  rotateRoundGroups,
} from "./metrics.mjs"
import {
  isAllowedBenchmarkResultPath,
  isPathWithinDirectory,
  resolveBenchmarkOutputPath,
  toGitPathspec,
  writeBenchmarkResultsSafely,
} from "./result-path.mjs"

// Resolved from this file rather than from an absolute path, so the benchmark
// runs on any checkout. Playwright is a devDependency of the repository, not of
// this directory.
const require = createRequire(import.meta.url)
const { chromium } = require("playwright")

const CORPUS = process.argv[2]
const APP_URL = process.argv[3] ?? "http://localhost:5173/"
const VARIANTS = (process.argv[4] ?? "baseline,dsp").split(",")
const CONDITIONS = (process.argv[5] ?? "").split(",").filter(Boolean)
const WARM_ROUNDS = Number(process.env.SPEECH_BENCH_ROUNDS ?? 3)

if (!Number.isInteger(WARM_ROUNDS) || WARM_ROUNDS < 1) {
  throw new Error("SPEECH_BENCH_ROUNDS must be a positive integer")
}

function resolveResultsPath() {
  const corpusPath = realpathSync(CORPUS)
  const candidate = join(corpusPath, "results.json")
  const resultsPath = resolveBenchmarkOutputPath(candidate)
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: import.meta.dirname,
    encoding: "utf8",
  }).trim()
  let isIgnored = false
  let isTracked = false

  if (isPathWithinDirectory(resultsPath, repositoryRoot)) {
    const relativeResultsPath = toGitPathspec(
      relative(repositoryRoot, resultsPath),
    )
    const trackedCheck = spawnSync(
      "git",
      ["ls-files", "--error-unmatch", "--", relativeResultsPath],
      { cwd: repositoryRoot, windowsHide: true },
    )
    if (trackedCheck.error) throw trackedCheck.error
    if (trackedCheck.status === 0) isTracked = true
    else if (trackedCheck.status !== 1) {
      throw new Error("Git could not verify whether results.json is tracked")
    }

    const ignoreCheck = spawnSync(
      "git",
      ["check-ignore", "--quiet", "--", relativeResultsPath],
      { cwd: repositoryRoot, windowsHide: true },
    )
    if (ignoreCheck.error) throw ignoreCheck.error
    if (ignoreCheck.status === 0) isIgnored = true
    else if (ignoreCheck.status !== 1) {
      throw new Error("Git could not verify whether results.json is ignored")
    }
  }

  if (
    !isAllowedBenchmarkResultPath(
      resultsPath,
      repositoryRoot,
      isIgnored,
      isTracked,
    )
  ) {
    throw new Error(
      "Refusing to write per-clip speech benchmark results inside the repository unless results.json is Git-ignored",
    )
  }
  return resultsPath
}

const RESULTS_PATH = resolveResultsPath()
const manifest = JSON.parse(readFileSync(`${CORPUS}/manifest.json`, "utf8"))
const entries = CONDITIONS.length
  ? manifest.filter((m) => CONDITIONS.includes(m.condition))
  : manifest

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function wer(reference, hypothesis) {
  const r = normalize(reference).split(" ").filter(Boolean)
  const h = normalize(hypothesis).split(" ").filter(Boolean)
  const d = Array.from({ length: r.length + 1 }, (_, i) =>
    Array.from({ length: h.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  )
  for (let i = 1; i <= r.length; i += 1) {
    for (let j = 1; j <= h.length; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1),
      )
    }
  }
  return { errors: d[r.length][h.length], words: r.length }
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(APP_URL)
  await page.waitForTimeout(2000)
  const productionConfig = await page.evaluate(async () => {
    const { PRODUCTION_SPEECH_CONFIG } =
      await import("/src/capabilities/speech.ts")
    return PRODUCTION_SPEECH_CONFIG
  })
  await page.evaluate((config) => {
    window.__productionSpeechConfig = config
  }, productionConfig)
  await page.addScriptTag({
    content: readFileSync(
      process.argv[6] ?? new URL("./variants.js", import.meta.url),
      "utf8",
    ),
  })
  const variantGroups = await page.evaluate((names) => {
    return window.__getVariantGroups(names)
  }, VARIANTS)

  const resultsByVariant = VARIANTS.map((variant) =>
    entries.map((entry) => ({
      variant,
      ...entry,
      hypothesis: null,
      errors: 0,
      words: 0,
      warmLatencyMs: [],
      medianWarmLatencyMs: null,
    })),
  )
  const results = resultsByVariant.flat()
  const warmupBytes = entries.length
    ? new Uint8Array(readFileSync(`${CORPUS}/noisy/${entries[0].file}`))
    : null

  for (let roundIndex = 0; roundIndex < WARM_ROUNDS; roundIndex += 1) {
    console.log(`Running warm round ${roundIndex + 1}/${WARM_ROUNDS}`)
    if (entries.length) {
      for (const [groupPosition, group] of rotateRoundGroups(
        variantGroups,
        roundIndex,
      ).entries()) {
        const firstVariant = group.variants[0].variant
        console.log(
          `Loading model group ${groupPosition + 1}/${variantGroups.length}`,
        )
        await page.evaluate(
          (name) => window.__prepareVariant(name),
          firstVariant,
        )
        try {
          for (const { variant } of rotateRoundGroups(
            group.variants,
            roundIndex,
          )) {
            await page.evaluate(
              async ([name, data]) => window.__runVariant(name, data),
              [variant, warmupBytes],
            )
          }

          for (const { entry, entryIndex, variants } of buildRoundSchedule(
            group.variants,
            entries,
            roundIndex,
          )) {
            const audioBytes = new Uint8Array(
              readFileSync(`${CORPUS}/noisy/${entry.file}`),
            )
            for (const { variant, variantIndex } of variants) {
              const measurement = await page.evaluate(
                async ([name, data]) => {
                  const started = performance.now()
                  const text = await window.__runVariant(name, data)
                  return { text, elapsedMs: performance.now() - started }
                },
                [variant, audioBytes],
              )
              const row = resultsByVariant[variantIndex][entryIndex]
              row.warmLatencyMs.push(measurement.elapsedMs)
              if (roundIndex === 0) {
                row.hypothesis = measurement.text
                const { errors, words } = wer(
                  entry.text,
                  measurement.text ?? "",
                )
                row.errors = errors
                row.words = words
              }
            }
          }
        } finally {
          await page.evaluate(
            (name) => window.__releaseVariantGroup(name),
            firstVariant,
          )
        }
      }
    }
  }

  for (const row of results) {
    row.medianWarmLatencyMs = median(row.warmLatencyMs)
  }

  // Per-clip transcripts and timings stay beside the ignored input corpus.
  writeBenchmarkResultsSafely(
    RESULTS_PATH,
    JSON.stringify(results, null, 2),
    resolveResultsPath,
  )

  function medianWer(rows) {
    if (!rows.length) return "n/a"
    return median(
      rows.map((r) => (100 * r.errors) / Math.max(1, r.words)),
    ).toFixed(1)
  }

  function summarize(rows) {
    const errors = rows.reduce((a, r) => a + r.errors, 0)
    const words = rows.reduce((a, r) => a + r.words, 0)
    return words ? ((100 * errors) / words).toFixed(1) : "n/a"
  }

  function summarizeLatency(rows) {
    const latency = medianPerClipLatency(rows)
    return latency === null ? "n/a" : latency.toFixed(0)
  }

  console.log("\n\n=== WER %% (lower is better) ===")
  const conditions = [...new Set(results.map((r) => r.condition))]
  const header = [
    "condition".padEnd(12),
    ...VARIANTS.map((v) => v.padStart(10)),
  ].join(" ")
  console.log(header)
  for (const c of conditions) {
    const row = [c.padEnd(12)]
    for (const v of VARIANTS) {
      row.push(
        summarize(
          results.filter((r) => r.condition === c && r.variant === v),
        ).padStart(10),
      )
    }
    console.log(row.join(" "))
  }
  console.log("-".repeat(header.length))
  for (const voice of ["male", "female"]) {
    const row = [`${voice}`.padEnd(12)]
    for (const v of VARIANTS) {
      row.push(
        summarize(
          results.filter((r) => r.voice === voice && r.variant === v),
        ).padStart(10),
      )
    }
    console.log(row.join(" "))
  }
  console.log("-".repeat(header.length))
  const med = ["MEDIAN WER".padEnd(12)]
  for (const v of VARIANTS)
    med.push(medianWer(results.filter((r) => r.variant === v)).padStart(10))
  console.log(med.join(" "))
  const loops = ["LOOP %".padEnd(12)]
  for (const v of VARIANTS)
    loops.push(loopRate(results.filter((r) => r.variant === v)).padStart(10))
  console.log(loops.join(" "))
  const total = ["OVERALL".padEnd(12)]
  for (const v of VARIANTS)
    total.push(summarize(results.filter((r) => r.variant === v)).padStart(10))
  console.log(total.join(" "))

  console.log(
    `\n=== MEDIAN WARM LATENCY ms (per-clip median, ${WARM_ROUNDS} measured rounds) ===`,
  )
  console.log(header)
  for (const c of conditions) {
    const row = [c.padEnd(12)]
    for (const v of VARIANTS) {
      row.push(
        summarizeLatency(
          results.filter((r) => r.condition === c && r.variant === v),
        ).padStart(10),
      )
    }
    console.log(row.join(" "))
  }
  console.log("-".repeat(header.length))
  for (const voice of ["male", "female"]) {
    const row = [`${voice}`.padEnd(12)]
    for (const v of VARIANTS) {
      row.push(
        summarizeLatency(
          results.filter((r) => r.voice === voice && r.variant === v),
        ).padStart(10),
      )
    }
    console.log(row.join(" "))
  }
  console.log("-".repeat(header.length))
  const latencyTotal = ["OVERALL".padEnd(12)]
  for (const v of VARIANTS)
    latencyTotal.push(
      summarizeLatency(results.filter((r) => r.variant === v)).padStart(10),
    )
  console.log(latencyTotal.join(" "))
} finally {
  await browser.close()
}
