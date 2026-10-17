import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { assertPinnedEngineSources } from "../vite.engine-startup"

const engineFiles = [
  "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js",
  "@powersync/web/lib/db/adapters/wa-sqlite/RawSqliteConnection.js",
  "@powersync/web/lib/worker/worker.js",
  "@powersync/web/lib/worker/client.js",
  "@powersync/web/lib/db/adapters/resolveAndValidateOptions.js",
  "@powersync/web/lib/db/adapters/wa-sqlite/WASQLiteOpenFactory.js",
  "@powersync/web/lib/db/adapters/wa-sqlite/vfs.js",
  "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs",
  "@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm",
]
const packageFiles = [
  "@powersync/web/package.json",
  "@journeyapps/wa-sqlite/package.json",
]
let scratch: string | undefined

function fixture() {
  scratch = mkdtempSync(join(tmpdir(), "cvc-engine-guards-"))
  for (const file of [...engineFiles, ...packageFiles]) {
    const target = join(scratch, "node_modules", file)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(resolve("node_modules", file), target)
  }
  return scratch
}

afterEach(() => {
  if (!scratch) return
  const target = resolve(scratch)
  const insideTemp = relative(resolve(tmpdir()), target)
  if (
    isAbsolute(insideTemp) ||
    insideTemp.startsWith("..") ||
    !basename(target).startsWith("cvc-engine-guards-")
  ) {
    throw new Error("Refusing to remove an unexpected guard-test directory")
  }
  rmSync(target, { recursive: true, force: true })
  scratch = undefined
})

describe("pinned engine integration guards", () => {
  it("accepts the exact installed engine inputs", () => {
    expect(() => assertPinnedEngineSources(fixture())).not.toThrow()
  })

  it.each(engineFiles)("refuses changed source or WASM bytes in %s", (file) => {
    const root = fixture()
    const target = join(root, "node_modules", file)
    writeFileSync(
      target,
      Buffer.concat([readFileSync(target), Buffer.from([0])]),
    )
    expect(() => assertPinnedEngineSources(root)).toThrow(file)
  })

  it.each(packageFiles)(
    "refuses an unreviewed package version in %s",
    (file) => {
      const root = fixture()
      const target = join(root, "node_modules", file)
      const value = JSON.parse(readFileSync(target, "utf8"))
      writeFileSync(target, JSON.stringify({ ...value, version: "99.0.0" }))
      expect(() => assertPinnedEngineSources(root)).toThrow()
    },
  )

  it("refuses a missing guarded engine file", () => {
    const root = fixture()
    rmSync(join(root, "node_modules", engineFiles[0]!))
    expect(() => assertPinnedEngineSources(root)).toThrow(engineFiles[0]!)
  })
})
