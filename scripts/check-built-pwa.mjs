import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const OCR_ASSETS = [
  "ocr/worker.min.js",
  "ocr/lang/ita.traineddata.gz",
  "ocr/core/tesseract-core-lstm.wasm.js",
  "ocr/core/tesseract-core-simd-lstm.wasm.js",
  "ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js",
]
const OCR_MAX_ASSET_BYTES = 4_500_000
const manifest = JSON.parse(
  readFileSync(resolve(root, "dist", "manifest.webmanifest"), "utf8"),
)

// The manifest's URLs are absolute on the serving origin, so they carry the
// base path the build was made for. dist/ is the root of that base, so the base
// has to come off again before a URL becomes a file path.
const base = manifest.scope ?? "/"
const distPath = (url) =>
  resolve(
    root,
    "dist",
    url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, ""),
  )

const assertPngDimensions = (path, size) => {
  const png = readFileSync(path)
  assert.equal(
    png.toString("hex", 0, 8),
    "89504e470d0a1a0a",
    `${path} must be PNG`,
  )
  assert.equal(png.readUInt32BE(16), size, `${path} must be ${size}px wide`)
  assert.equal(png.readUInt32BE(20), size, `${path} must be ${size}px high`)
}

assert.equal(
  manifest.start_url,
  base,
  "PWA start_url and scope must agree, or an installed app opens outside its own scope",
)

for (const size of ["192x192", "512x512"]) {
  const icon = manifest.icons?.find((candidate) => candidate.sizes === size)
  assert.ok(icon, `PWA manifest is missing the ${size} icon`)
  assert.ok(
    existsSync(distPath(icon.src)),
    `Built PWA icon does not exist: ${icon.src}`,
  )
  assertPngDimensions(distPath(icon.src), Number.parseInt(size, 10))
}
const appleTouchIcon = readFileSync(
  resolve(root, "dist", "index.html"),
  "utf8",
).match(/<link rel="apple-touch-icon" href="([^"]+)"/)
assert.ok(appleTouchIcon, "Built app is missing its Apple touch icon link")
assertPngDimensions(distPath(appleTouchIcon[1]), 180)
assert.ok(
  existsSync(resolve(root, "dist", "sw.js")),
  "PWA service worker missing",
)

const serviceWorker = readFileSync(resolve(root, "dist", "sw.js"), "utf8")
for (const asset of OCR_ASSETS) {
  const assetPath = resolve(root, "dist", asset)
  assert.ok(existsSync(assetPath), `Built OCR asset does not exist: ${asset}`)
  assert.ok(
    statSync(assetPath).size <= OCR_MAX_ASSET_BYTES,
    `Built OCR asset exceeds the precache size limit: ${asset}`,
  )
  assert.ok(
    serviceWorker.includes(`url:"${asset}"`),
    `Built service worker does not precache OCR asset: ${asset}`,
  )
}

console.log(
  `PASS: built PWA manifest, icons, service worker and ${OCR_ASSETS.length} precached OCR assets`,
)
