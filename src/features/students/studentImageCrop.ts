export interface NormalizedCrop {
  x: number
  y: number
  width: number
  height: number
}

export type CropGesture =
  "move" | "north-west" | "north-east" | "south-west" | "south-east"
  | "north" | "east" | "south" | "west"

/**
 * The whole frame. A roster photograph is normally already framed tightly on
 * the table, so trimming a default margin cut into the first column and lost
 * the start of the surnames before OCR ever ran. The operator can still crop.
 */
export const DEFAULT_STUDENT_SCAN_CROP: NormalizedCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

export interface NormalizedPoint {
  x: number
  y: number
}

/**
 * Return the signed angle of a line in degrees, normalized to [-90, 90].
 * A table row can be drawn in either direction; both directions describe the
 * same horizontal line for straightening purposes.
 */
export function normalizedLineAngle(start: NormalizedPoint, end: NormalizedPoint) {
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
  let normalized = angle
  while (normalized > 90) normalized -= 180
  while (normalized < -90) normalized += 180
  return normalized
}

/**
 * Calculate the signed rotation delta for a radial direct-manipulation handle.
 */
export function rotationDeltaFromPoints(
  center: NormalizedPoint,
  start: NormalizedPoint,
  current: NormalizedPoint,
) {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const currentAngle = Math.atan2(current.y - center.y, current.x - center.x)
  let delta = ((currentAngle - startAngle) * 180) / Math.PI
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

const MIN_CROP_SIZE = 0.16

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function rotatedImageDimensions(
  width: number,
  height: number,
  degrees: number,
) {
  const radians = (degrees * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  return {
    width: Math.max(1, Math.ceil(width * cosine + height * sine - 1e-10)),
    height: Math.max(1, Math.ceil(width * sine + height * cosine - 1e-10)),
  }
}

export function updateNormalizedCrop(
  crop: NormalizedCrop,
  gesture: CropGesture,
  deltaX: number,
  deltaY: number,
): NormalizedCrop {
  const left = crop.x
  const top = crop.y
  const right = crop.x + crop.width
  const bottom = crop.y + crop.height

  if (gesture === "move") {
    return {
      ...crop,
      x: clamp(left + deltaX, 0, 1 - crop.width),
      y: clamp(top + deltaY, 0, 1 - crop.height),
    }
  }

  const nextLeft = gesture.includes("west")
    ? clamp(left + deltaX, 0, right - MIN_CROP_SIZE)
    : left
  const nextRight = gesture.includes("east")
    ? clamp(right + deltaX, left + MIN_CROP_SIZE, 1)
    : right
  const nextTop = gesture.includes("north")
    ? clamp(top + deltaY, 0, bottom - MIN_CROP_SIZE)
    : top
  const nextBottom = gesture.includes("south")
    ? clamp(bottom + deltaY, top + MIN_CROP_SIZE, 1)
    : bottom

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  }
}

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

async function loadImage(blob: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
    })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = "async"
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Immagine non leggibile"))
    }
    image.src = url
  })
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  }
}

function renderRotatedImage(
  loaded: LoadedImage,
  degrees: number,
  maximumDimension: number,
) {
  const fullSize = rotatedImageDimensions(loaded.width, loaded.height, degrees)
  const scale = Math.min(
    1,
    maximumDimension / Math.max(fullSize.width, fullSize.height),
  )
  const width = Math.max(1, Math.round(fullSize.width * scale))
  const height = Math.max(1, Math.round(fullSize.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Canvas non disponibile")

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.translate(width / 2, height / 2)
  context.rotate((degrees * Math.PI) / 180)
  context.scale(scale, scale)
  context.drawImage(loaded.source, -loaded.width / 2, -loaded.height / 2)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Impossibile preparare l’immagine"))
    }, "image/png")
  })
}

export async function createStudentScanPreview(image: Blob, degrees: number) {
  const loaded = await loadImage(image)
  try {
    const canvas = renderRotatedImage(loaded, degrees, 1_200)
    const blob = await canvasToBlob(canvas)
    return {
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    loaded.dispose()
  }
}

export async function prepareStudentScanImage(
  image: Blob,
  degrees: number,
  crop: NormalizedCrop,
) {
  const loaded = await loadImage(image)
  try {
    const rotated = renderRotatedImage(loaded, degrees, 2_600)
    const sourceX = Math.round(crop.x * rotated.width)
    const sourceY = Math.round(crop.y * rotated.height)
    const sourceWidth = Math.max(1, Math.round(crop.width * rotated.width))
    const sourceHeight = Math.max(1, Math.round(crop.height * rotated.height))
    const output = document.createElement("canvas")
    output.width = sourceWidth
    output.height = sourceHeight
    const context = output.getContext("2d", { alpha: false })
    if (!context) throw new Error("Canvas non disponibile")
    context.drawImage(
      rotated,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    )
    return await canvasToBlob(output)
  } finally {
    loaded.dispose()
  }
}
