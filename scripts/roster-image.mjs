/**
 * The Node side of the scan's image preparation, for measurements and tests.
 * The browser decodes onto a canvas, erases on its RGBA pixels and encodes a
 * PNG; this does the same with sharp (already used by the synthetic corpus
 * generator). The eraser is passed in so the one implementation in
 * src/capabilities/studentScanRules.ts is what both paths run.
 */
import sharp from "sharp"

export async function eraseRulesFromImageBytes(bytes, eraseVerticalTableRules) {
  // Orient from EXIF first, as the browser's image decoding does; the PNG
  // written below carries no orientation of its own.
  const { data, info } = await sharp(bytes)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const erasure = eraseVerticalTableRules(data, info.width, info.height)
  if (erasure.rules === 0) return { bytes, ...erasure }
  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
  return { bytes: png, ...erasure }
}
