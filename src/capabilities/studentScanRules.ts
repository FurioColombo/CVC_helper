/**
 * Printed rosters are ruled tables, and the rule between the row number and
 * the name cell is the one that hurts: Tesseract removes rules only from its
 * internal layout image, while the recognizer still reads the original
 * pixels, so `12|Rossi` arrives as one word. The digits and the rule are
 * stripped from the name afterwards, but the word keeps the low confidence
 * they caused, and a correctly read surname is flagged. On the owner's clear
 * photograph that was every flag on the sheet.
 *
 * This erases long vertical rules before recognition, in place, on RGBA
 * pixels (canvas `ImageData` in the browser, a decoded buffer in Node). It
 * only paints each rule's own band with the paper beside it; ink that merely
 * touches a rule keeps its strokes, and a sheet without long rules is left
 * untouched. Horizontal rules stay: they are what keeps Tesseract reading a
 * table row as one line.
 */

export interface VerticalRuleErasure {
  rules: number
  erasedPixels: number
}

// Local threshold: ink is darker than the mean of its 31 px neighbourhood.
const THRESHOLD_WINDOW = 31
const THRESHOLD_OFFSET = 12
// A seed is a column whose ink runs this long, allowing a 2 px slant and
// 3 px breaks; text strokes are a line tall, rules span many lines.
const SEED_SPREAD = 2
const SEED_MAX_GAP = 3
// A rule slice is at most this wide; wider ink is text touching the rule.
const MAX_RULE_THICKNESS = 8
// Tracking tolerates short breaks and bridges touching text. A capital that
// touches the rule on a close 2600 px capture is a text line tall, so the
// bridge spans that; bridged rows are kept only when the rule continues clean
// after them, and are erased only over the rule's own width.
const MAX_BLANK_ROWS = 4
const MAX_BRIDGED_ROWS = 120
// A tracked piece must be rule-length and mostly clean rule slices, so a
// thin letter aligned under the end of a rule is never taken for it.
const MIN_SEGMENT_ROWS = 45
const MIN_CLEAN_SHARE = 0.6
// Half a pixel of antialiasing beside the measured rule width.
const ERASE_MARGIN = 0.5
// Dark ink along the photo's own edge is its border or background, never a
// table rule, and repainting it only disturbs Tesseract's page layout.
const EDGE_MARGIN = 10

function greyOf(pixels: ArrayLike<number>, width: number, height: number) {
  const grey = new Uint8Array(width * height)
  for (let i = 0; i < grey.length; i += 1) {
    // Rec. 601 luma in fixed point: 77 + 150 + 29 = 256.
    grey[i] =
      (77 * pixels[i * 4]! +
        150 * pixels[i * 4 + 1]! +
        29 * pixels[i * 4 + 2]! +
        128) >>
      8
  }
  return grey
}

/**
 * Ink is darker than the mean of its window by the offset. The window sums
 * slide along rows and then down columns, so each pixel costs a few additions
 * and the comparison needs no division.
 */
function inkMask(grey: Uint8Array, width: number, height: number) {
  const half = THRESHOLD_WINDOW >> 1
  const rowSums = new Uint16Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    let sum = 0
    for (let x = 0; x < Math.min(width, half); x += 1) sum += grey[row + x]!
    for (let x = 0; x < width; x += 1) {
      if (x + half < width) sum += grey[row + x + half]!
      if (x - half - 1 >= 0) sum -= grey[row + x - half - 1]!
      rowSums[row + x] = sum
    }
  }
  const windowWidths = new Uint16Array(width)
  for (let x = 0; x < width; x += 1) {
    windowWidths[x] = Math.min(width, x + half + 1) - Math.max(0, x - half)
  }
  const columnSums = new Uint32Array(width)
  const addRow = (y: number, sign: 1 | -1) => {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      columnSums[x] = columnSums[x]! + sign * rowSums[row + x]!
    }
  }
  for (let y = 0; y < Math.min(height, half); y += 1) addRow(y, 1)
  const ink = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    if (y + half < height) addRow(y + half, 1)
    if (y - half - 1 >= 0) addRow(y - half - 1, -1)
    const windowHeight = Math.min(height, y + half + 1) - Math.max(0, y - half)
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const area = windowWidths[x]! * windowHeight
      ink[row + x] =
        (grey[row + x]! + THRESHOLD_OFFSET) * area < columnSums[x]! ? 1 : 0
    }
  }
  return ink
}

interface Seed {
  x: number
  y0: number
  y1: number
}

/** The longest slant-tolerant vertical ink run of every column. */
function columnSeeds(
  ink: Uint8Array,
  width: number,
  height: number,
  minRun: number,
) {
  // Horizontal dilation by SEED_SPREAD, row by row, with a sliding count.
  const near = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    let count = 0
    for (let x = 0; x < Math.min(width, SEED_SPREAD); x += 1)
      count += ink[row + x]!
    for (let x = 0; x < width; x += 1) {
      const entering = x + SEED_SPREAD
      const leaving = x - SEED_SPREAD - 1
      if (entering < width) count += ink[row + entering]!
      if (leaving >= 0) count -= ink[row + leaving]!
      near[row + x] = count > 0 ? 1 : 0
    }
  }
  const start = new Int32Array(width).fill(-1)
  const last = new Int32Array(width).fill(-1)
  const gap = new Int32Array(width)
  const best: Array<Seed | null> = Array.from({ length: width }, () => null)
  const close = (x: number) => {
    const s = start[x]!
    const l = last[x]!
    const current = best[x]
    if (
      s >= 0 &&
      l - s + 1 >= minRun &&
      (!current || l - s > current.y1 - current.y0)
    )
      best[x] = { x, y0: s, y1: l }
    start[x] = -1
    gap[x] = 0
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      if (near[row + x]) {
        if (start[x]! < 0) start[x] = y
        last[x] = y
        gap[x] = 0
      } else if (start[x]! >= 0 && gap[x]! < SEED_MAX_GAP) {
        gap[x] = gap[x]! + 1
      } else if (start[x]! >= 0) {
        close(x)
      }
    }
  }
  for (let x = 0; x < width; x += 1) close(x)
  return best
    .filter((seed): seed is Seed => seed !== null)
    .sort((left, right) => right.y1 - right.y0 - (left.y1 - left.y0))
}

function spanAt(ink: Uint8Array, width: number, y: number, x: number) {
  if (x < 0 || x >= width || !ink[y * width + x]) return null
  let left = x
  let right = x
  while (left > 0 && ink[y * width + left - 1]) left -= 1
  while (right < width - 1 && ink[y * width + right + 1]) right += 1
  return { left, right }
}

function nearestSpan(ink: Uint8Array, width: number, y: number, x: number) {
  const centre = Math.round(x)
  for (let distance = 0; distance <= 2; distance += 1) {
    const span =
      spanAt(ink, width, y, centre - distance) ??
      (distance ? spanAt(ink, width, y, centre + distance) : null)
    if (span) return span
  }
  return null
}

/**
 * Where to start following a seed: the row nearest its middle whose slice has
 * the seed's typical width. The middle row itself can fall inside a letter
 * that touches the rule, whose wider slice would start the track off centre.
 */
function seedStart(ink: Uint8Array, width: number, seed: Seed) {
  const slices: Array<{ y: number; left: number; right: number }> = []
  for (let y = seed.y0; y <= seed.y1; y += 1) {
    const span = nearestSpan(ink, width, y, seed.x)
    if (span) slices.push({ y, ...span })
  }
  const thickness = ({ left, right }: { left: number; right: number }) =>
    right - left + 1
  const widths = slices.map(thickness).sort((left, right) => left - right)
  const typical = widths[Math.floor(widths.length / 2)]
  const middle = (seed.y0 + seed.y1) / 2
  let start: (typeof slices)[number] | undefined
  for (const slice of slices) {
    if (thickness(slice) !== typical) continue
    if (!start || Math.abs(slice.y - middle) < Math.abs(start.y - middle)) {
      start = slice
    }
  }
  return start ? { y: start.y, x: (start.left + start.right) / 2 } : null
}

interface TrackPoint {
  y: number
  x: number
  thickness: number
  clean: boolean
  blank: boolean
}

/**
 * Follow a rule one row at a time. A thin slice near the prediction moves the
 * track; wider ink (text touching the rule) is bridged at the prediction.
 */
function follow(
  ink: Uint8Array,
  width: number,
  height: number,
  x: number,
  from: number,
  step: 1 | -1,
  maxThickness: number,
) {
  const points: TrackPoint[] = []
  let predicted = x
  let blanks = 0
  let bridged = 0
  for (let y = from; y >= 0 && y < height; y += step) {
    const span = nearestSpan(ink, width, y, predicted)
    if (span) {
      const thickness = span.right - span.left + 1
      const centre = (span.left + span.right) / 2
      if (thickness <= maxThickness && Math.abs(centre - predicted) <= 1.5) {
        predicted = centre
        points.push({ y, x: centre, thickness, clean: true, blank: false })
        blanks = 0
        bridged = 0
        continue
      }
      bridged += 1
      if (bridged > MAX_BRIDGED_ROWS) break
      points.push({ y, x: predicted, thickness: 0, clean: false, blank: false })
      blanks = 0
      continue
    }
    blanks += 1
    if (blanks > MAX_BLANK_ROWS) break
    points.push({ y, x: predicted, thickness: 0, clean: false, blank: true })
  }
  while (points.length > 0 && !points.at(-1)!.clean) points.pop()
  return points
}

/** A rule's own width: the median of its clean slices. */
function cleanWidth(points: TrackPoint[]) {
  const widths = points
    .filter(({ clean }) => clean)
    .map(({ thickness }) => thickness)
    .sort((left, right) => left - right)
  return widths[Math.floor(widths.length / 2)] ?? 1
}

/** Split at blank rows and keep only rule-length, mostly clean pieces. */
function ruleSegments(track: TrackPoint[]) {
  const segments: TrackPoint[][] = []
  let current: TrackPoint[] = []
  for (const point of track) {
    if (point.blank) {
      if (current.length > 0) segments.push(current)
      current = []
    } else {
      current.push(point)
    }
  }
  if (current.length > 0) segments.push(current)
  return segments.filter(
    (segment) =>
      segment.length >= MIN_SEGMENT_ROWS &&
      segment.filter(({ clean }) => clean).length >=
        segment.length * MIN_CLEAN_SHARE,
  )
}

export function eraseVerticalTableRules(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): VerticalRuleErasure {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) {
    return { rules: 0, erasedPixels: 0 }
  }
  const grey = greyOf(pixels, width, height)
  const ink = inkMask(grey, width, height)
  const minSeedRun = Math.max(60, Math.round(height * 0.035))
  const minRuleRows = Math.max(120, Math.round(height * 0.08))
  const claimed = new Uint8Array(width * height)
  let rules = 0
  let erasedPixels = 0

  for (const seed of columnSeeds(ink, width, height, minSeedRun)) {
    if (seed.x < EDGE_MARGIN || seed.x >= width - EDGE_MARGIN) continue
    if (claimed[Math.round((seed.y0 + seed.y1) / 2) * width + seed.x]) continue
    const start = seedStart(ink, width, seed)
    if (!start) continue
    const { x, y: middle } = start
    if (claimed[middle * width + Math.round(x)]) continue
    const trackWithin = (maxThickness: number) => [
      ...follow(ink, width, height, x, middle - 1, -1, maxThickness).reverse(),
      ...follow(ink, width, height, x, middle, 1, maxThickness),
    ]
    // The first pass finds the rule and its own width; the second follows it
    // again allowing only that width, so a thin stroke touching the rule is
    // bridged at the rule's position instead of pulling the band onto it.
    const firstPass = ruleSegments(trackWithin(MAX_RULE_THICKNESS)).flat()
    if (firstPass.length < minRuleRows) continue
    const track = trackWithin(
      Math.min(MAX_RULE_THICKNESS, cleanWidth(firstPass) + 1),
    )
    const points = ruleSegments(track).flat()
    if (points.length < minRuleRows) continue

    const thickness = cleanWidth(points)
    const halfBand = thickness / 2 + ERASE_MARGIN
    const claimHalf = Math.ceil(thickness / 2) + 2
    for (const point of track) {
      const row = point.y * width
      for (let dx = -claimHalf; dx <= claimHalf; dx += 1) {
        const column = Math.round(point.x) + dx
        if (column >= 0 && column < width) claimed[row + column] = 1
      }
    }

    rules += 1
    for (const { y, x: centre } of points) {
      const row = y * width
      const left = Math.max(0, Math.floor(centre - halfBand))
      const right = Math.min(width - 1, Math.ceil(centre + halfBand))
      // Paint with the lighter paper just outside the band on this row.
      const outsideLeft = row + Math.max(0, left - 2)
      const outsideRight = row + Math.min(width - 1, right + 2)
      const paper =
        grey[outsideLeft]! >= grey[outsideRight]! ? outsideLeft : outsideRight
      for (let column = left; column <= right; column += 1) {
        const index = row + column
        if (grey[index]! >= grey[paper]!) continue
        pixels[index * 4] = pixels[paper * 4]!
        pixels[index * 4 + 1] = pixels[paper * 4 + 1]!
        pixels[index * 4 + 2] = pixels[paper * 4 + 2]!
        erasedPixels += 1
      }
    }
  }
  return { rules, erasedPixels }
}

/**
 * The browser path around {@link eraseVerticalTableRules}. The image as chosen
 * is returned whenever there is nothing to erase or no canvas to do it on, so
 * a failure here can only cost the improvement, never the scan.
 */
export async function eraseVerticalTableRulesFromImage(image: Blob) {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return image
  }
  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(image)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return image
    context.drawImage(bitmap, 0, 0)
    const frame = context.getImageData(0, 0, canvas.width, canvas.height)
    if (
      eraseVerticalTableRules(frame.data, frame.width, frame.height).rules === 0
    )
      return image
    context.putImageData(frame, 0, 0)
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? image), "image/png")
    })
  } catch {
    return image
  } finally {
    bitmap?.close()
  }
}
