import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const pinnedEngineFiles = [
  [
    "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js",
    "809018e8976a8001bfac6062b1faa2a75333bd004885c8918f926c9e596e9cc6",
  ],
  [
    "@powersync/web/lib/db/adapters/wa-sqlite/RawSqliteConnection.js",
    "3579d112ac08acff0c0e5253a20f9229b14c7e0812d87f7f8e016cfa0dac9155",
  ],
  [
    "@powersync/web/lib/worker/worker.js",
    "f9154d972df907eb5b174b7a221a5436fec58ca20e8875e688c36c6cabc6f3b2",
  ],
  [
    "@powersync/web/lib/worker/client.js",
    "d8709fbf190b38c7f489df2e921beb58cff1a4a6f01819d82bc6c16d983b66bc",
  ],
  [
    "@powersync/web/lib/db/adapters/resolveAndValidateOptions.js",
    "47d97f29cc71108041035a1515053f0f6de6ee69453deda19a674175967fcd99",
  ],
  [
    "@powersync/web/lib/db/adapters/wa-sqlite/WASQLiteOpenFactory.js",
    "c0fcb28492bc1b06c98e537b0a51e61c77898776f27dfba51b3da21833874c5f",
  ],
  [
    "@powersync/web/lib/db/adapters/wa-sqlite/vfs.js",
    "75bcf404ee0ddfc3f017793ba51b8a49985759468b367f85e523f62d3cdbec45",
  ],
  [
    "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs",
    "7c51584cda641a6a4c2bef4436b3f677c8284d9713fab9768d1d360179241e61",
  ],
  [
    "@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm",
    "de7105eb124a6d6a90bcea9b569433af50cb90eba6f1e8c3f210be6dfde7d013",
  ],
] as const

function sha256(contents: Uint8Array) {
  return createHash("sha256").update(contents).digest("hex")
}

function readPackageVersion(nodeModules: string, packagePath: string) {
  return (
    JSON.parse(
      readFileSync(path.resolve(nodeModules, packagePath), "utf8"),
    ) as {
      version: string
    }
  ).version
}

export function assertPinnedEngineSources(root: string) {
  const nodeModules = path.resolve(root, "node_modules")
  if (
    readPackageVersion(nodeModules, "@powersync/web/package.json") !==
      "2.2.0" ||
    readPackageVersion(nodeModules, "@journeyapps/wa-sqlite/package.json") !==
      "2.0.3"
  ) {
    throw new Error(
      "The PowerSync startup seam is pinned to @powersync/web 2.2.0 and wa-sqlite 2.0.3",
    )
  }
  for (const [relativePath, expectedHash] of pinnedEngineFiles) {
    const sourcePath = path.resolve(nodeModules, relativePath)
    let actualHash: string
    try {
      actualHash = sha256(readFileSync(sourcePath))
    } catch (error) {
      throw new Error(
        "PowerSync startup source guard could not read " +
          relativePath +
          ": " +
          (error instanceof Error ? error.message : String(error)),
        { cause: error },
      )
    }
    if (actualHash !== expectedHash) {
      throw new Error(
        "PowerSync startup source guard failed for " +
          relativePath +
          ": expected " +
          expectedHash +
          ", received " +
          actualHash,
      )
    }
  }
}
