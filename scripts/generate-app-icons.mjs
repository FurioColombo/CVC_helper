import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import sharp from "sharp"

const root = resolve(import.meta.dirname, "..")
const markPath = resolve(root, "public/brand/cvc-symbol.png")
const svgPath = resolve(root, "public/icons/cvc-helper.svg")
const iconDirectory = resolve(root, "public/icons")
const mark = await readFile(markPath)
const markMetadata = await sharp(mark).metadata()

assert.equal(markMetadata.format, "png", "Home's CVC mark must remain a PNG")
assert.ok(
  markMetadata.width && markMetadata.height,
  "Home's CVC mark has dimensions",
)

const viewSize = 512
const markWidth = 340
const markHeight = (markWidth * markMetadata.height) / markMetadata.width
const markX = (viewSize - markWidth) / 2
const markY = 120
const labelBaseline = 375
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}">
  <rect width="${viewSize}" height="${viewSize}" fill="#ffffff" />
  <image
    href="data:image/png;base64,${mark.toString("base64")}"
    x="${markX}" y="${markY}" width="${markWidth}" height="${markHeight}"
    preserveAspectRatio="xMidYMid meet"
  />
  <text
    x="${viewSize / 2}" y="${labelBaseline}"
    fill="#2f5fa0" font-family="Arial, Helvetica, sans-serif"
    font-size="68" font-weight="700" letter-spacing="3"
    text-anchor="middle"
  >HELPER</text>
</svg>
`

await writeFile(svgPath, svg)

for (const size of [180, 192, 512]) {
  const output = resolve(iconDirectory, `cvc-helper-${size}.png`)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(output)
  console.log(`Generated ${output}`)
}
