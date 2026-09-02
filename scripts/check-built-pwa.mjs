import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const manifest = JSON.parse(
  readFileSync(resolve(root, "dist", "manifest.webmanifest"), "utf8"),
)

for (const size of ["192x192", "512x512"]) {
  const icon = manifest.icons?.find((candidate) => candidate.sizes === size)
  assert.ok(icon, `PWA manifest is missing the ${size} icon`)
  assert.ok(
    existsSync(resolve(root, "dist", icon.src.replace(/^\//, ""))),
    `Built PWA icon does not exist: ${icon.src}`,
  )
}
assert.ok(
  existsSync(resolve(root, "dist", "sw.js")),
  "PWA service worker missing",
)

console.log("PASS: built PWA manifest, icons and service worker")
