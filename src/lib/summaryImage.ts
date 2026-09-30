/**
 * Shared primitives for the app's F3 rasterised summary images: the crew
 * summary (`features/crews/crewSummaryImage.ts`) and the Comandate summary
 * (`features/duties/dutySummaryImage.ts`) are both "a screenshot of the read
 * view, shareable as a PNG" — same warm-paper palette, same top header block
 * (eyebrow, title, rule), same rounded card-with-coloured-edge frame, same
 * text-wrapping/name-and-badge row layout, same warning badge, same
 * SVG-to-canvas rasterisation and the same browser download. Only the
 * page-specific content — what goes inside a card, which groups exist — stays
 * in each feature's own module. Keeping these pieces in one place means a
 * palette or rasterisation fix reaches both exports at once instead of
 * drifting apart, and the crew export's own behaviour and tests are
 * unaffected: this module only lifts code out, it changes no output.
 */

export const WIDTH = 1080
export const PAGE_PADDING = 40
export const COLUMN_GAP = 24
export const CARD_GAP = 24

export const FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

// The read views' own warm-paper palette (`AnnouncementView` in
// CrewManagement.tsx, `DutySummaryView` in DutyManagement.tsx), not the app's
// general `--background`/`--primary`: an exported image is a screenshot of
// its read view, so it uses the same colours.
export const BG = "#fffdf8"
export const INK = "#102f3b"
export const ACCENT = "#0b526b"
export const BORDER = "#c8d7db"
export const RULE = "#dbe4e6"
export const MUTED = "#6b8790"
export const CARD_BG = "#ffffff"
export const WARNING_YELLOW_BG = "#fff3cd"
export const WARNING_YELLOW_FG = "#8a5a00"
export const WARNING_RED_BG = "#fee4e2"
export const WARNING_RED_FG = "#b42318"
// The app-wide "Minore" marker (`docs/post-mvp/06_DESIGN_RULEBOOK.md` §3: "M
// bianca su rosso"), the same colour `PersonBadges.tsx`'s `MinorBadge` uses.
export const MINOR_BG = "#b42318"

export const NAME_FONT = 32
export const NAME_LINE_HEIGHT = 40
export const BADGE_HEIGHT = 32
export const BADGE_FONT = 18
export const BADGE_GAP = 8
export const ROW_GAP = 16

export const CARD_EDGE_WIDTH = 8
export const CARD_PADDING = 24

export function cleanText(value: unknown): string {
  const source = String(value ?? "")
  let result = ""

  for (const character of source) {
    const codePoint = character.codePointAt(0) ?? 0
    const validXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    result += validXmlCharacter ? character : "�"
  }

  return result
}
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  const maxCharacters = Math.max(6, Math.floor(maxWidth / (fontSize * 0.58)))
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    let rest = word
    while (Array.from(rest).length > maxCharacters) {
      lines.push(Array.from(rest).slice(0, maxCharacters).join(""))
      rest = Array.from(rest).slice(maxCharacters).join("")
    }
    const next = current ? `${current} ${rest}` : rest
    if (Array.from(next).length > maxCharacters && current) {
      lines.push(current)
      current = rest
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ["—"]
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return Array.from(text).length * fontSize * 0.58
}

export function renderTextLines(
  lines: string[],
  x: number,
  baselineY: number,
  fontSize: number,
  lineHeight: number,
  attributes = "",
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${baselineY + index * lineHeight}" font-family="${FONT_FAMILY}" font-size="${fontSize}" ${attributes}>${escapeXml(line)}</text>`,
    )
    .join("")
}

/**
 * Wraps a raw set of stroke-only `<path>`s (lucide's own vocabulary, a 24×24
 * viewBox) into a positioned, sized, coloured `<g>` — the one place both
 * exporters turn an icon's path data into on-canvas markup, so a feature's
 * own icon set (crew's gommone/available/a-terra/empty, duty's completed
 * check) only ever has to supply path strings, never re-derive the transform
 * math.
 */
export function renderVectorIcon(
  innerSvg: string,
  x: number,
  y: number,
  size: number,
  color: string,
  strokeWidth = 2,
): string {
  const scale = size / 24
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${innerSvg}</g>`
}

// lucide's `triangle-alert` (aliased as `alert-triangle`), the same icon
// `AnnouncementCrewCard` and the Comandate day card use on screen.
const WARNING_TRIANGLE_INNER =
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'

/**
 * The corner warning badge both `AnnouncementCrewCard` (equipaggi) and the
 * Comandate day card show: a rounded coloured square with the warning
 * triangle inside. `ariaLabel` is the caller's own, since a crew's and a
 * duty day's accessible wording differ ("Avviso equipaggio: …" vs "Avviso
 * comandata: …").
 */
export function renderWarningBadge(
  severity: "red" | "yellow",
  x: number,
  y: number,
  ariaLabel: string,
): string {
  const size = 44
  const bg = severity === "red" ? WARNING_RED_BG : WARNING_YELLOW_BG
  const fg = severity === "red" ? WARNING_RED_FG : WARNING_YELLOW_FG
  const iconSize = 24
  return `<g aria-label="${escapeXml(ariaLabel)}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="14" fill="${bg}"/>${renderVectorIcon(WARNING_TRIANGLE_INNER, x + (size - iconSize) / 2, y + (size - iconSize) / 2, iconSize, fg)}</g>`
}

export type SummaryBadge = {
  text: string
  fill: string
  color: string
  stroke?: string
}

export function badgeWidth(text: string): number {
  return Math.max(34, Math.round(text.length * BADGE_FONT * 0.62) + 20)
}

export function renderBadges(
  badges: SummaryBadge[],
  x: number,
  y: number,
): { svg: string; width: number } {
  let cursorX = x
  const svg = badges
    .map((badge) => {
      const width = badgeWidth(badge.text)
      const currentX = cursorX
      cursorX += width + BADGE_GAP
      return `<g><rect x="${currentX}" y="${y}" width="${width}" height="${BADGE_HEIGHT}" rx="8" fill="${badge.fill}" ${badge.stroke ? `stroke="${badge.stroke}" stroke-width="2"` : ""}/><text x="${currentX + width / 2}" y="${y + BADGE_HEIGHT / 2 + 6}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${BADGE_FONT}" font-weight="800" fill="${badge.color}">${escapeXml(badge.text)}</text></g>`
    })
    .join("")
  return { svg, width: badges.length ? cursorX - x - BADGE_GAP : 0 }
}

/**
 * A name (wrapped to fit) plus its badges right after the name's last line,
 * as the read view shows them, or at the row's right edge when that line
 * leaves no room — one roster row, whether it belongs to a crew member or a
 * duty student. The caller supplies the already-decided badges (minor/duty/
 * role for a crew member, minor only for a duty student), so this stays
 * ignorant of what a badge means.
 */
export function layoutMemberRow(
  label: string,
  badges: SummaryBadge[],
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const badgesWidth = badges.reduce(
    (sum, badge, index) =>
      sum + badgeWidth(badge.text) + (index ? BADGE_GAP : 0),
    0,
  )
  const nameWidth = Math.max(100, width - badgesWidth - (badgesWidth ? 20 : 0))
  const cleanLabel = cleanText(label).trim() || "Nome non disponibile"
  const nameLines = wrapText(cleanLabel, nameWidth, NAME_FONT)
  const height = Math.max(NAME_LINE_HEIGHT, nameLines.length * NAME_LINE_HEIGHT)
  const nameSvg = renderTextLines(
    nameLines,
    x,
    y + NAME_FONT,
    NAME_FONT,
    NAME_LINE_HEIGHT,
    `font-weight="700" fill="${INK}"`,
  )
  const lastLine = nameLines.length - 1
  // Names are bold, and the width estimate is for regular text: leave room so
  // a badge never touches the name it follows.
  const afterName =
    x + estimateTextWidth(nameLines[lastLine] ?? "", NAME_FONT) * 1.12 + 18
  const badgesX = Math.min(afterName, x + width - badgesWidth)
  const badgeSvg = badges.length
    ? renderBadges(
        badges,
        badgesX,
        y + lastLine * NAME_LINE_HEIGHT + (NAME_LINE_HEIGHT - BADGE_HEIGHT) / 2,
      ).svg
    : ""

  return {
    svg: `<g data-member-label="${escapeXml(cleanLabel)}">${nameSvg}${badgeSvg}</g>`,
    height,
  }
}

/** The rounded white card body plus its left coloured edge — every summary
 *  card (a crew, a Comandata day) is this frame with feature-specific content
 *  layered on top at the same coordinates. */
export function renderCardFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  edgeColor: string,
  edgeWidth: number = CARD_EDGE_WIDTH,
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/><rect x="${x}" y="${y}" width="${edgeWidth}" height="${height}" fill="${edgeColor}"/>`
}

/**
 * The page's top block: a small tracked-out eyebrow, the big title (wrapped,
 * never truncated), and a full-width rule — identical between the crew
 * export ("EQUIPAGGI") and the Comandate export ("COMANDATE"), only the
 * words differ.
 */
export function renderSummaryHeader(input: {
  eyebrow: string
  title: string
  fallbackTitle: string
  contentWidth: number
}): { svg: string; height: number } {
  const { eyebrow, title, fallbackTitle, contentWidth } = input
  let cursorY = PAGE_PADDING
  let svg = `<text x="${PAGE_PADDING}" y="${cursorY + 24}" font-family="${FONT_FAMILY}" font-size="26" font-weight="800" letter-spacing="3" fill="${INK}">${escapeXml(eyebrow)}</text>`
  cursorY += 50
  const titleText = cleanText(title).trim() || fallbackTitle
  const titleLines = wrapText(titleText, contentWidth, 58)
  svg += renderTextLines(
    titleLines,
    PAGE_PADDING,
    cursorY + 50,
    58,
    66,
    `font-weight="800" fill="${INK}"`,
  )
  cursorY += titleLines.length * 66 + 22
  svg += `<line x1="${PAGE_PADDING}" y1="${cursorY}" x2="${PAGE_PADDING + contentWidth}" y2="${cursorY}" stroke="${BORDER}" stroke-width="2"/>`
  cursorY += 44
  return { svg, height: cursorY - PAGE_PADDING }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error("Impossibile preparare il riepilogo."))
    image.src = url
  })
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else
          reject(new Error("Impossibile creare l’immagine PNG del riepilogo."))
      }, "image/png")
    })
  }

  const dataUrl = canvas.toDataURL("image/png")
  const encoded = dataUrl.split(",")[1]
  if (!encoded)
    throw new Error("Impossibile creare l’immagine PNG del riepilogo.")
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return Promise.resolve(new Blob([bytes], { type: "image/png" }))
}

export type RasteriseOptions = {
  /** Output pixel density. The default produces a crisp 2× phone image. */
  pixelRatio?: number
}

/**
 * Turns a finished, self-contained SVG string (its own `width`/`height`
 * attributes included) into a rasterised PNG blob at `pixelRatio` — the one
 * canvas pipeline both `buildCrewSummaryPng` and `buildDutySummaryPng` call
 * after building their own model-specific SVG markup.
 */
export async function rasteriseSvgToPng(
  svg: string,
  options: RasteriseOptions = {},
): Promise<Blob> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Il riepilogo PNG richiede un browser compatibile.")
  }
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const image = await loadImage(svgUrl)
    const dimensions = svg.match(
      /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/u,
    )
    if (!dimensions)
      throw new Error("Impossibile leggere le dimensioni del riepilogo.")
    const width = Number(dimensions[1])
    const height = Number(dimensions[2])
    const pixelRatio = Math.min(3, Math.max(1, options.pixelRatio ?? 2))
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)
    const context = canvas.getContext("2d")
    if (!context)
      throw new Error("Il browser non supporta la creazione di PNG.")
    context.scale(pixelRatio, pixelRatio)
    context.drawImage(image, 0, 0, width, height)
    const png = await canvasToPng(canvas)
    if (png.type && png.type !== "image/png") {
      throw new Error("Il browser ha restituito un formato immagine inatteso.")
    }
    return png.type ? png : new Blob([png], { type: "image/png" })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** A short, safe, lower-case filename from a free-text title, e.g. for
 *  `anchor.download`. Falls back to `fallback` when the title has no
 *  alphanumeric content at all. */
export function makeSummaryFilename(title: string, fallback: string): string {
  const slug = cleanText(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return `${slug || fallback}.png`
}

/** Triggers a browser download of `png` as `filename`, cleaning up both
 *  temporary object URLs — the one the caller already created for
 *  rasterisation is the caller's responsibility; this only owns the URL it
 *  creates for the anchor. */
export async function downloadPngBlob(
  png: Blob,
  filename: string,
): Promise<void> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error(
      "Il download del riepilogo richiede un browser compatibile.",
    )
  }
  const url = URL.createObjectURL(png)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  try {
    document.body.appendChild(anchor)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  } finally {
    anchor.remove()
  }
}
