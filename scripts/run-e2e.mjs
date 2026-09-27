import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

// RR-3: an OS-assigned free port, found by binding to port 0 and releasing it
// immediately. This is handed to Playwright (see playwright.config.ts) as the
// server it must start itself. Picking a fresh port every run, instead of a
// fixed one, means this can never attach to a Vite server left running by
// another worktree or a stale build — Playwright's own `webServer` (with
// `reuseExistingServer: false`) always launches a brand new process here.
async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address()
      probe.close(() => resolvePort(port))
    })
  })
}

const port = await getFreePort()
const baseURL = `http://127.0.0.1:${port}`

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
      env: { ...process.env, CVC_E2E_BASE_URL: baseURL },
      stdio: "inherit",
    },
  )
  child.on("error", reject)
  child.on("close", (exitCode) => resolveStatus(exitCode ?? 1))
})

process.exitCode = status
