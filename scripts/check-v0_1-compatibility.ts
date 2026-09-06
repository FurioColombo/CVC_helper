import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { verifyV010Compatibility } from "../src/test/fixtures/v0_1_compatibility"

const result = verifyV010Compatibility()

if (process.argv.includes("--evidence")) {
  const evidenceDirectory = resolve(import.meta.dirname, "../.evidence/U00")
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(
    resolve(evidenceDirectory, "compatibility-v0.1.0.json"),
    `${JSON.stringify(
      { ...result, recordedAt: new Date().toISOString() },
      null,
      2,
    )}\n`,
  )
}

console.log(
  `PASS: ${result.appVersion} compatibility fixture (${Object.values(
    result.tableCounts,
  ).reduce((total, count) => total + count, 0)} rows)`,
)
