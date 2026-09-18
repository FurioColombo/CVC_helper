import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"

const require = createRequire(
  "C:/Users/Marco Furio Colombo/Desktop/CVC_helper/package.json",
)
const { chromium } = require("playwright")

const CORPUS = process.argv[2]
const URL = process.argv[3] ?? "http://localhost:5173/"
const VARIANTS = (process.argv[4] ?? "baseline,dsp").split(",")
const CONDITIONS = (process.argv[5] ?? "").split(",").filter(Boolean)

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
    Array.from({ length: h.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
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
const page = await browser.newPage()
page.on("console", (m) => {
  if (m.type() === "error") console.log("PAGE ERROR:", m.text().slice(0, 160))
})
await page.goto(URL)
await page.waitForTimeout(2000)
await page.addScriptTag({ content: readFileSync(process.argv[6] ?? (CORPUS + "/../variants.js"), "utf8") })

const results = []
for (const variant of VARIANTS) {
  console.log(`\n### loading variant: ${variant}`)
  await page.evaluate(async (v) => { await window.__prepareVariant(v) }, variant)
  for (const entry of entries) {
    const b64 = readFileSync(`${CORPUS}/noisy/${entry.file}`).toString("base64")
    const text = await page.evaluate(
      async ([v, data]) => window.__runVariant(v, data),
      [variant, b64],
    )
    const { errors, words } = wer(entry.text, text ?? "")
    results.push({ variant, ...entry, hypothesis: text, errors, words })
    process.stdout.write(".")
  }
}
await browser.close()

writeFileSync(`${CORPUS}/results.json`, JSON.stringify(results, null, 2))

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function loopRate(rows) {
  if (!rows.length) return "n/a"
  const looped = rows.filter(
    (r) => String(r.hypothesis).split(/s+/).filter(Boolean).length > r.words * 3,
  ).length
  return ((100 * looped) / rows.length).toFixed(0)
}

function medianWer(rows) {
  if (!rows.length) return "n/a"
  return median(rows.map((r) => (100 * r.errors) / Math.max(1, r.words))).toFixed(1)
}

function summarize(rows) {
  const errors = rows.reduce((a, r) => a + r.errors, 0)
  const words = rows.reduce((a, r) => a + r.words, 0)
  return words ? ((100 * errors) / words).toFixed(1) : "n/a"
}

console.log("\n\n=== WER %% (lower is better) ===")
const conditions = [...new Set(results.map((r) => r.condition))]
const header = ["condition".padEnd(12), ...VARIANTS.map((v) => v.padStart(10))].join(" ")
console.log(header)
for (const c of conditions) {
  const row = [c.padEnd(12)]
  for (const v of VARIANTS) {
    row.push(summarize(results.filter((r) => r.condition === c && r.variant === v)).padStart(10))
  }
  console.log(row.join(" "))
}
console.log("-".repeat(header.length))
for (const voice of ["male", "female"]) {
  const row = [`${voice}`.padEnd(12)]
  for (const v of VARIANTS) {
    row.push(summarize(results.filter((r) => r.voice === voice && r.variant === v)).padStart(10))
  }
  console.log(row.join(" "))
}
console.log("-".repeat(header.length))
const med = ["MEDIAN WER".padEnd(12)]
for (const v of VARIANTS) med.push(medianWer(results.filter((r) => r.variant === v)).padStart(10))
console.log(med.join(" "))
const loops = ["LOOP %".padEnd(12)]
for (const v of VARIANTS) loops.push(loopRate(results.filter((r) => r.variant === v)).padStart(10))
console.log(loops.join(" "))
const total = ["OVERALL".padEnd(12)]
for (const v of VARIANTS) total.push(summarize(results.filter((r) => r.variant === v)).padStart(10))
console.log(total.join(" "))
