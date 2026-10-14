import sharp from "sharp"

type Box = { x: number; y: number; width: number; height: number }

type Region = { name: string; boxes: Box[] }

type RegionResult = {
  name: string
  boxes: number
  pixels: number
  mean: number
  share: number
  colour: number
}

const BACKGROUND = { r: 0xff, g: 0xfd, b: 0xf8 }
const COLOUR_BLOCK = 12

/** Keep this pixel-mask transform identical to summary-image-checks.ts. */
async function paintBackgroundOver(
  image: Buffer,
  boxes: Box[],
  ratio: number,
): Promise<Buffer> {
  const { width, height } = await sharp(image).metadata()
  const overlays = boxes
    .map((box) => ({
      left: Math.round(box.x * ratio),
      top: Math.round(box.y * ratio),
      width: Math.round(box.width * ratio),
      height: Math.round(box.height * ratio),
    }))
    .map((box) => {
      const left = Math.max(0, box.left)
      const top = Math.max(0, box.top)
      return {
        left,
        top,
        width: Math.min(width!, box.left + box.width) - left,
        height: Math.min(height!, box.top + box.height) - top,
      }
    })
    .filter((box) => box.width > 0 && box.height > 0)
  return sharp(image)
    .composite(
      overlays.map(({ left, top, width, height }) => ({
        input: {
          create: { width, height, channels: 3, background: BACKGROUND },
        },
        left,
        top,
      })),
    )
    .toBuffer()
}

/**
 * Repeats imageDifference.ts's flatten/resize and nearest 3x3 greyscale pixel
 * comparison, accumulating only the CSS-grid pixels covered by each region.
 */
export async function compareRasterRegions(input: {
  image: Buffer
  screen: Buffer
  excluded: Box[]
  ratio: number
  cssWidth: number
  cssHeight: number
  regions: Region[]
}): Promise<RegionResult[]> {
  const [image, screen] = await Promise.all([
    paintBackgroundOver(input.image, input.excluded, input.ratio),
    paintBackgroundOver(input.screen, input.excluded, input.ratio),
  ])
  const imageMeta = await sharp(image).metadata()
  const visibleImage = await sharp(image)
    .extract({
      left: 0,
      top: 0,
      width: imageMeta.width!,
      height: Math.min(
        imageMeta.height!,
        Math.round(input.cssHeight * input.ratio),
      ),
    })
    .toBuffer()
  const prepared = (buffer: Buffer) =>
    sharp(buffer).flatten({ background: BACKGROUND })
  const grid = (buffer: Buffer, width: number, height: number) =>
    prepared(buffer)
      .resize(width, height, { fit: "fill", kernel: "lanczos3" })
      .removeAlpha()
  const [lumaA, lumaB] = await Promise.all(
    [visibleImage, screen].map((buffer) =>
      grid(buffer, input.cssWidth, input.cssHeight)
        .greyscale()
        .raw()
        .toBuffer(),
    ),
  )

  const columns = Math.max(1, Math.round(input.cssWidth / COLOUR_BLOCK))
  const rows = Math.max(1, Math.round(input.cssHeight / COLOUR_BLOCK))
  const [blocksA, blocksB] = await Promise.all(
    [visibleImage, screen].map((buffer) =>
      grid(buffer, columns, rows).raw().toBuffer(),
    ),
  )

  const regions = [
    ...input.regions,
    {
      name: "full-frame-visible",
      boxes: [{ x: 0, y: 0, width: input.cssWidth, height: input.cssHeight }],
    },
  ]
  return regions.map(({ name, boxes }) => {
    const regionMask = new Uint8Array(input.cssWidth * input.cssHeight)
    for (const box of boxes) {
      const left = Math.max(0, Math.ceil(box.x - 0.5))
      const right = Math.max(
        0,
        Math.min(input.cssWidth, Math.ceil(box.x + box.width - 0.5)),
      )
      const top = Math.max(0, Math.ceil(box.y - 0.5))
      const bottom = Math.max(
        0,
        Math.min(input.cssHeight, Math.ceil(box.y + box.height - 0.5)),
      )
      for (let row = top; row < bottom; row += 1) {
        regionMask.fill(
          1,
          row * input.cssWidth + left,
          row * input.cssWidth + right,
        )
      }
    }
    const contains = (x: number, y: number) =>
      boxes.some(
        (box) =>
          x + 0.5 >= box.x &&
          x + 0.5 < box.x + box.width &&
          y + 0.5 >= box.y &&
          y + 0.5 < box.y + box.height,
      )
    let total = 0
    let differing = 0
    let pixels = 0
    for (let row = 0; row < input.cssHeight; row += 1) {
      for (let column = 0; column < input.cssWidth; column += 1) {
        const here = row * input.cssWidth + column
        if (regionMask[here] === 0) continue
        pixels += 1
        let aInB = 255
        let bInA = 255
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const y = row + dy
            const x = column + dx
            if (y < 0 || y >= input.cssHeight || x < 0 || x >= input.cssWidth) {
              continue
            }
            const there = y * input.cssWidth + x
            aInB = Math.min(aInB, Math.abs(lumaA![here]! - lumaB![there]!))
            bInA = Math.min(bInA, Math.abs(lumaB![here]! - lumaA![there]!))
          }
        }
        const closest = Math.max(aInB, bInA)
        total += closest
        if (closest > 40) differing += 1
      }
    }

    let colourTotal = 0
    let colourBlocks = 0
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const centerX = ((column + 0.5) * input.cssWidth) / columns
        const centerY = ((row + 0.5) * input.cssHeight) / rows
        if (!contains(centerX - 0.5, centerY - 0.5)) continue
        let largest = 0
        const pixel = row * columns + column
        for (let channel = 0; channel < 3; channel += 1) {
          largest = Math.max(
            largest,
            Math.abs(
              blocksA![pixel * 3 + channel]! - blocksB![pixel * 3 + channel]!,
            ),
          )
        }
        colourTotal += largest
        colourBlocks += 1
      }
    }
    return {
      name,
      boxes: boxes.length,
      pixels,
      mean: pixels ? total / pixels : 0,
      share: pixels ? differing / pixels : 0,
      colour: colourBlocks ? colourTotal / colourBlocks : 0,
    }
  })
}
