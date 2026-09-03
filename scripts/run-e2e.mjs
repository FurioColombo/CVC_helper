import { spawn } from "node:child_process"
import { resolve } from "node:path"

import { createServer } from "vite"

const root = resolve(import.meta.dirname, "..")
const url = "http://127.0.0.1:4173"
let server = null

async function serverIsReady() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  } catch {
    return false
  }
}

if (!(await serverIsReady())) {
  server = await createServer({
    configFile: resolve(root, "vite.config.ts"),
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  })
  await server.listen()
}

const playwrightCli = resolve(
  root,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
)
const status = await new Promise((resolveStatus, reject) => {
  const child = spawn(
    process.execPath,
    [playwrightCli, "test", ...process.argv.slice(2)],
    {
      cwd: root,
      env: { ...process.env, CVC_E2E_SERVER_READY: "1" },
      stdio: "inherit",
    },
  )
  child.on("error", reject)
  child.on("close", (exitCode) => resolveStatus(exitCode ?? 1))
})

if (server) await server.close()
process.exitCode = status
