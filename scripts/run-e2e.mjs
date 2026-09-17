import { spawn } from "node:child_process"
import { resolve } from "node:path"

import { createServer } from "vite"

const root = resolve(import.meta.dirname, "..")
const url = "http://127.0.0.1:4174"
let server = null

async function respondsAt(path = "/") {
  try {
    const response = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(2_000),
    })
    return response.ok
  } catch {
    return false
  }
}

// Only the Vite dev server serves its own client module. Reusing anything else
// on this port would test whatever that process happens to serve, which can be
// a stale build, so fail loudly instead.
const viteIsReady = await respondsAt("/@vite/client")

if (!viteIsReady) {
  if (await respondsAt("/")) {
    throw new Error(
      `${url} is already serving something that is not the Vite dev server. ` +
        `Stop that process before running the browser suite.`,
    )
  }
  server = await createServer({
    configFile: resolve(root, "vite.config.ts"),
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
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
