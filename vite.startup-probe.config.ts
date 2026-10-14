import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import baseConfig from "./vite.config"
import { defineConfig, mergeConfig, type Alias, type UserConfig } from "vite"

if (process.env.CVC_ENGINE_STARTUP_PROBE !== "true") {
  throw new Error(
    "Set CVC_ENGINE_STARTUP_PROBE=true for this diagnostic config",
  )
}

const root = import.meta.dirname
const nodeModules = path.resolve(root, "node_modules")

function readPackageVersion(packagePath: string) {
  return (
    JSON.parse(
      readFileSync(path.resolve(nodeModules, packagePath), "utf8"),
    ) as {
      version: string
    }
  ).version
}

function assertPinnedFile(relativePath: string, expectedHash: string) {
  const actualHash = createHash("sha256")
    .update(readFileSync(path.resolve(nodeModules, relativePath)))
    .digest("hex")
  if (actualHash !== expectedHash) {
    throw new Error(
      `Startup probe source guard failed for ${relativePath}: ${actualHash}`,
    )
  }
}

if (
  readPackageVersion("@powersync/web/package.json") !== "2.2.0" ||
  readPackageVersion("@journeyapps/wa-sqlite/package.json") !== "2.0.3"
) {
  throw new Error(
    "The startup probe is pinned to PowerSync 2.2.0 / wa-sqlite 2.0.3",
  )
}

assertPinnedFile(
  "@powersync/web/lib/worker/worker.js",
  "f9154d972df907eb5b174b7a221a5436fec58ca20e8875e688c36c6cabc6f3b2",
)
assertPinnedFile(
  "@powersync/web/lib/worker/client.js",
  "d8709fbf190b38c7f489df2e921beb58cff1a4a6f01819d82bc6c16d983b66bc",
)
assertPinnedFile(
  "@powersync/web/lib/db/adapters/resolveAndValidateOptions.js",
  "47d97f29cc71108041035a1515053f0f6de6ee69453deda19a674175967fcd99",
)
assertPinnedFile(
  "@powersync/web/lib/db/adapters/wa-sqlite/WASQLiteOpenFactory.js",
  "c0fcb28492bc1b06c98e537b0a51e61c77898776f27dfba51b3da21833874c5f",
)
assertPinnedFile(
  "@powersync/web/lib/db/adapters/wa-sqlite/vfs.js",
  "75bcf404ee0ddfc3f017793ba51b8a49985759468b367f85e523f62d3cdbec45",
)
assertPinnedFile(
  "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs",
  "7c51584cda641a6a4c2bef4436b3f677c8284d9713fab9768d1d360179241e61",
)

const merged = mergeConfig(
  baseConfig,
  defineConfig({
    define: {
      "import.meta.env.VITE_CVC_ENGINE_STARTUP_PROBE": JSON.stringify("true"),
    },
    optimizeDeps: {
      exclude: ["@powersync/web", "@journeyapps/wa-sqlite"],
    },
    worker: { format: "es" },
  }),
) as UserConfig

const existingAliases = merged.resolve?.alias ?? []
const aliases: Alias[] = Array.isArray(existingAliases)
  ? existingAliases
  : Object.entries(existingAliases).map(([find, replacement]) => ({
      find,
      replacement,
    }))

merged.resolve = {
  ...merged.resolve,
  alias: [
    ...aliases,
    {
      find: /^@journeyapps\/wa-sqlite\/dist\/wa-sqlite-async\.mjs$/,
      replacement: path.resolve(root, "src/persistence/waSqliteFactory.ts"),
    },
  ],
}

export default defineConfig(merged)
