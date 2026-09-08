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
