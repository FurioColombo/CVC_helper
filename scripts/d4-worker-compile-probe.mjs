import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const compilerPath = path.join(root, "src/persistence/engineModuleCompiler.ts")
const d1SpecPath = path.join(root, "tests/e2e/d1-migration.spec.ts")
const expectedCompilerSha256 =
  "EE6CB299BD8B3E30681D5A367AC8283EAD6D443B04016E8F8676EF76852F92C3"
const expectedD1SpecSha256 =
  "F84D4A73613AF1C260119066E054D7FE08212BD39CA6755A8724C1DE5E201D56"
const unchangedTestFiles = [
  {
    path: d1SpecPath,
    sha256: expectedD1SpecSha256,
  },
  {
    path: path.join(root, "src/test/d1MigrationHarness.ts"),
    sha256: "B38B60DD9B9DDB11F215CD1E05B95ADFCFA846681D278377DA2B6A2DC858F000",
  },
  {
    path: path.join(root, "tests/e2e/cold-browser.ts"),
    sha256: "491A438999F922C1E9A5CCF8BE868B9447E25B8F35F661CF32C0F3BBCFFD27E0",
  },
  {
    path: path.join(root, "playwright.config.ts"),
    sha256: "76052CB18641100798098B5F0676759DC895EB1F81D7862E05D0EA17CA006BE9",
  },
]

const streamingBody = `      const response = timings
        ? fetch(url.href).then((result) => {
            // fetch resolves once status and response headers are available.
            timings.workerResponseHeadersAt =
              performance.timeOrigin + performance.now()
            return result
          })
        : fetch(url.href)
      if (timings) {
        timings.workerCompileCalledAt =
          performance.timeOrigin + performance.now()
      }
      const module = await WebAssembly.compileStreaming(response)`

const workerSyncBody = `      const response = await fetch(url.href)
      if (timings) {
        timings.workerResponseHeadersAt =
          performance.timeOrigin + performance.now()
      }
      const mimeType = response.headers
        .get("Content-Type")
        ?.replace(/^[\\t ]+|[\\t ]+$/g, "")
      const expectedMimeType = "application/wasm"
      const hasExpectedMimeType =
        mimeType !== undefined &&
        mimeType.length === expectedMimeType.length &&
        [...mimeType].every((character, index) => {
          const code = character.charCodeAt(0)
          const asciiLowercase =
            code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character
          return asciiLowercase === expectedMimeType[index]
        })
      if (!response.ok || !hasExpectedMimeType) {
        throw new Error(
          "PowerSync WASM response does not meet compileStreaming requirements",
        )
      }
      const buffer = await response.arrayBuffer()
      if (timings) {
        timings.workerCompileCalledAt =
          performance.timeOrigin + performance.now()
      }
      const module = new WebAssembly.Module(buffer)`

function sha256(filePath) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex")
    .toUpperCase()
}

function readPatchableCompiler() {
  const compiler = readFileSync(compilerPath, "utf8")
  if (sha256(compilerPath) !== expectedCompilerSha256) {
    throw new Error("Compiler source differs from the reviewed probe base")
  }
  for (const file of unchangedTestFiles) {
    if (sha256(file.path) !== file.sha256) {
      throw new Error(
        `${path.relative(root, file.path)} differs from the probe base`,
      )
    }
  }
  if (compiler.split(streamingBody).length !== 2) {
    throw new Error("Expected one unchanged compileStreaming body")
  }
  return compiler
}

const [mode] = process.argv.slice(2)
if (mode === "--check") {
  readPatchableCompiler()
  console.log(
    "Probe base, D1 test, seed harness, browser fixture, and project options validated",
  )
} else if (mode === "worker-sync") {
  const compiler = readPatchableCompiler()
  writeFileSync(compilerPath, compiler.replace(streamingBody, workerSyncBody))
  const patched = readFileSync(compilerPath, "utf8")
  if (!patched.includes(workerSyncBody) || patched.includes(streamingBody)) {
    throw new Error("Worker-sync compiler substitution did not verify")
  }
  for (const file of unchangedTestFiles) {
    if (sha256(file.path) !== file.sha256) {
      throw new Error(
        `${path.relative(root, file.path)} changed during substitution`,
      )
    }
  }
  console.log(
    "Applied worker-sync compiler probe; D1 test, seed harness, browser fixture, and project options are unchanged",
  )
} else {
  throw new Error(
    "Usage: node scripts/d4-worker-compile-probe.mjs --check|worker-sync",
  )
}
