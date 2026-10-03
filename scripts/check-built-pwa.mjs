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
// The CVC mark is rendered on first paint on every cold-start screen
// (App.tsx's header), so it has to survive an offline install the same way
// OCR does. The seven boat-model marks are not needed at startup, but the F3
// crew-summary read view (`BoatIdentity.tsx`) and the image saved from it
// (F4, `pageSnapshot.ts`) both depend on them working offline too — an
// operator reading or sharing that summary on the water has no way to fetch
// a missing one. Kept in sync by hand with `BRAND_PRECACHED_IMAGES` in
// vite.config.ts, which is what actually puts these in the precache.
const BRAND_PRECACHED_IMAGES = [
  "brand/cvc-symbol.png",
  "brand/boats/rs-toura.png",
  "brand/boats/rs-quest.png",
  "brand/boats/laser-vago.png",
  "brand/boats/rs-500.png",
  "brand/boats/j80.png",
  "brand/boats/first-25-7.png",
  "brand/boats/first-27.png",
]
const manifest = JSON.parse(
  readFileSync(resolve(root, "dist", "manifest.webmanifest"), "utf8"),
)

// Derived the same way `base` is computed in vite.config.ts, independently of
// anything the manifest itself claims. Comparing the manifest only to its own
// `scope` (as an earlier version of this script did) would pass even if the
// base prefix went missing everywhere at once — self-consistency is not the
// same as matching the configured deployment path.
const expectedBase = (() => {
  const configured = process.env.CVC_BASE_PATH?.trim()
  if (!configured || configured === "/") return "/"
  return `/${configured.replace(/^\/+|\/+$/g, "")}/`
})()

// The manifest's URLs are absolute on the serving origin, so they carry the
// base path the build was made for. dist/ is the root of that base, so the base
// has to come off again before a URL becomes a file path.
const distPath = (url) =>
  resolve(
    root,
    "dist",
    url.startsWith(expectedBase)
      ? url.slice(expectedBase.length)
      : url.replace(/^\//, ""),
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
  expectedBase,
  "PWA start_url must match the configured base path (CVC_BASE_PATH)",
)
assert.equal(
  manifest.scope,
  expectedBase,
  "PWA scope must match the configured base path (CVC_BASE_PATH)",
)

// RR-17: without this, a build that silently dropped the base prefix from an
// icon or asset URL (while start_url/scope still happened to match each
// other) would still pass every other check here.
for (const icon of manifest.icons ?? []) {
  assert.ok(
    icon.src.startsWith(expectedBase),
    `PWA icon src must start with the configured base path: ${icon.src}`,
  )
}

for (const size of ["192x192", "512x512"]) {
  const icon = manifest.icons?.find((candidate) => candidate.sizes === size)
  assert.ok(icon, `PWA manifest is missing the ${size} icon`)
  assert.ok(
    existsSync(distPath(icon.src)),
    `Built PWA icon does not exist: ${icon.src}`,
  )
  assertPngDimensions(distPath(icon.src), Number.parseInt(size, 10))
}

// The manifest's own background_color drifted from the app's actual surface
// colour once before (cream vs. the light blue `--background` actually
// painted behind every screen). Tying the two together here means they can
// only drift again on purpose.
const stylesCss = readFileSync(resolve(root, "src", "styles.css"), "utf8")
const backgroundVariable = stylesCss.match(/--background:\s*(#[0-9a-fA-F]+)/)
assert.ok(
  backgroundVariable,
  "Could not find --background in src/styles.css to compare against the manifest",
)
assert.equal(
  manifest.background_color,
  backgroundVariable[1],
  "PWA manifest background_color must match --background in src/styles.css",
)

const indexHtml = readFileSync(resolve(root, "dist", "index.html"), "utf8")

const appleTouchIcon = indexHtml.match(
  /<link rel="apple-touch-icon" href="([^"]+)"/,
)
assert.ok(appleTouchIcon, "Built app is missing its Apple touch icon link")
assertPngDimensions(distPath(appleTouchIcon[1]), 180)

// RR-17, continued: index.html's own script/stylesheet/manifest links are a
// second place the base prefix can go missing independently of the manifest.
for (const match of indexHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
  const url = match[1]
  assert.ok(
    url.startsWith(expectedBase),
    `index.html references an asset outside the configured base path: ${url}`,
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

for (const asset of BRAND_PRECACHED_IMAGES) {
  const assetPath = resolve(root, "dist", asset)
  assert.ok(existsSync(assetPath), `Built brand image does not exist: ${asset}`)
  assert.ok(
    serviceWorker.includes(`url:"${asset}"`),
    `Built service worker does not precache brand image: ${asset}`,
  )
}

console.log(
  `PASS: built PWA manifest, icons, service worker, ${OCR_ASSETS.length} precached OCR assets and ${BRAND_PRECACHED_IMAGES.length} precached brand images`,
)
