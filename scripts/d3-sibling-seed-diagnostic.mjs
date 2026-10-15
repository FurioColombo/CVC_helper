import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
const path = "tests/e2e/d1-migration.spec.ts"
let source = readFileSync(path, "utf8").replaceAll("\r\n", "\n")
const anchor =
  "    await openBlankPage(page)\n    const result = await harness<{\n      durationMs: number"
assert.equal(source.split(anchor).length, 2)
const replacement =
  '    await openBlankPage(page)\n    const seedPage = await page.context().newPage()\n    let siblingFilename: string\n    try {\n      await openBlankPage(seedPage)\n      siblingFilename = await harness<string>(seedPage, "seedLargeUpgrade")\n    } finally {\n      await seedPage.close()\n    }\n    const result = await harness<{\n      durationMs: number'
source = source.replace(anchor, replacement)
const call = '}>(page, "runLargeUpgrade")'
assert.equal(source.split(call).length, 2)
source = source.replace(
  call,
  '}>(page, "measureLargeUpgrade", siblingFilename!)',
)
writeFileSync(path, source)
console.log(
  "Diagnostic only: unchanged D1 result assertions and bounds; same seed function moved to sibling page",
)
