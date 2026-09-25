export type CrewSummaryRole = "IS" | "ADV" | "CT"
export type CrewSummaryCategory =
  "available" | "sailing" | "mezzi" | "a-terra" | "empty"

export type CrewSummaryMember = {
  label: string
  isMinor: boolean
  duty: "current" | "smontante" | null
  role?: CrewSummaryRole | null
}

export type CrewSummaryLine = {
  category: CrewSummaryCategory
  crewNumber?: number
  destination?: string
  members: CrewSummaryMember[]
}

export type CrewSummaryOptions = {
  /** Output pixel density. The default produces a crisp 2× phone image. */
  pixelRatio?: number
}

const CATEGORY_ORDER: CrewSummaryCategory[] = [
  "available",
  "sailing",
  "mezzi",
  "a-terra",
  "empty",
]
const CATEGORY_LABEL: Record<CrewSummaryCategory, string> = {
  available: "Persone disponibili",
  sailing: "Equipaggi in uscita",
  mezzi: "Mezzi",
  "a-terra": "A terra",
  empty: "Barche ed equipaggi vuoti",
}
const CREW_LIMIT_FOR_TWO_COLUMNS = 12
const ONE_COLUMN_WIDTH = 1040
const TWO_COLUMN_WIDTH = 1200
const PAGE_PADDING = 28
const COLUMN_GAP = 24
const CARD_GAP = 12
const FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const BLUE = "#2f5fa0"

function cleanText(value: unknown): string {
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
    result += validXmlCharacter ? character : "\uFFFD"
  }

  return result
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
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

function renderTextLines(
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

type Badge = {
  text: string
  width: number
  fill: string
  color: string
  stroke?: string
}

function memberBadges(member: CrewSummaryMember): Badge[] {
  const badges: Badge[] = []
  if (member.role) {
    const width = member.role === "ADV" ? 34 : 28
    badges.push({ text: member.role, width, fill: "#eaf1fa", color: BLUE })
  }
  if (member.duty === "current") {
    badges.push({ text: "C", width: 18, fill: BLUE, color: "#ffffff" })
  } else if (member.duty === "smontante") {
    badges.push({
      text: "SM",
      width: 25,
      fill: "#ffffff",
      color: BLUE,
      stroke: BLUE,
    })
  }
  if (member.isMinor) {
    badges.push({ text: "M", width: 18, fill: "#b42318", color: "#ffffff" })
  }
  return badges
}

function renderBadges(
  badges: Badge[],
  x: number,
  y: number,
): { svg: string; width: number } {
  const gap = 4
  let cursorX = x
  const svg = badges
    .map((badge) => {
      const currentX = cursorX
      cursorX += badge.width + gap
      return `<g><rect x="${currentX}" y="${y}" width="${badge.width}" height="18" rx="5" fill="${badge.fill}" stroke="${badge.stroke ?? "none"}" stroke-width="${badge.stroke ? 1.5 : 0}"/><text x="${currentX + badge.width / 2}" y="${y + 12.5}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${badge.text.length > 2 ? 8 : 9}" font-weight="800" fill="${badge.color}">${badge.text}</text></g>`
    })
    .join("")
  return {
    svg,
    width: badges.length ? cursorX - x - gap : 0,
  }
}

function layoutMember(
  member: CrewSummaryMember,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = 2
  const fontSize = 18
  const lineHeight = 22
  const badges = memberBadges(member)
  const badgeWidth = badges.reduce(
    (sum, badge, index) => sum + badge.width + (index ? 4 : 0),
    0,
  )
  const nameWidth = Math.max(
    74,
    width - padding * 2 - badgeWidth - (badgeWidth ? 7 : 0),
  )
  const label = cleanText(member.label).trim() || "Nome non disponibile"
  const nameLines = wrapText(label, nameWidth, fontSize)
  const height = Math.max(26, nameLines.length * lineHeight + 4)
  const text = renderTextLines(
    nameLines,
    x + padding,
    y + 18,
    fontSize,
    lineHeight,
    'fill="#172b47"',
  )
  const badgeSvg = renderBadges(
    badges,
    x + width - padding - badgeWidth,
    y + 3,
  ).svg

  return {
    svg: `<g data-member-label="${escapeXml(label)}">${text}${badgeSvg}</g>`,
    height,
  }
}

function renderCategoryIcon(
  category: CrewSummaryCategory,
  x: number,
  y: number,
): string {
  const common = `fill="none" stroke="${BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
  let drawing: string
  if (category === "available") {
    drawing = `<circle cx="${x + 9}" cy="${y + 7}" r="3"/><circle cx="${x + 20}" cy="${y + 7}" r="3"/><path d="M${x + 3} ${y + 20}c.3-4 2.7-6 6-6 1.6 0 2.8.5 3.7 1.4M${x + 25} ${y + 20}c-.3-4-2.7-6-6-6-1.6 0-2.8.5-3.7 1.4M${x + 9} ${y + 21}c.3-4 2.8-6 6-6s5.7 2 6 6"/>`
  } else if (category === "sailing" || category === "empty") {
    drawing = `<path d="M${x + 3} ${y + 18}h22l-3 4H7zM${x + 14} ${y + 2}v15M${x + 12} ${y + 4}L${x + 6} ${y + 13}h8zM${x + 16} ${y + 6}h7v7z"${category === "empty" ? ' stroke-dasharray="2 2"' : ""}/>`
  } else if (category === "mezzi") {
    drawing = `<path d="M${x + 4} ${y + 9}h20v12H4zM${x + 9} ${y + 9}V5h10v4M${x + 11} ${y + 14}h6"/>`
  } else {
    // A standing person on a ground line keeps A terra distinct from the boat groups.
    drawing = `<circle cx="${x + 14}" cy="${y + 5}" r="3"/><path d="M${x + 14} ${y + 8}v7m0-4-5 4m5-4 5 4m-5-4-4 9m4-9 4 9M${x + 3} ${y + 23}h22"/>`
  }
  return `<g ${common} aria-label="${CATEGORY_LABEL[category]}">${drawing}</g>`
}

function renderSectionHeading(
  category: CrewSummaryCategory,
  y: number,
): string {
  const iconX = PAGE_PADDING
  const iconY = y + 1
  const textY = y + 20
  const label = CATEGORY_LABEL[category]
  return `<g data-summary-section="${category}">${renderCategoryIcon(category, iconX, iconY)}<text x="${PAGE_PADDING + 34}" y="${textY}" font-family="${FONT_FAMILY}" font-size="19" font-weight="700" fill="#172b47">${escapeXml(label)}</text><line x1="${PAGE_PADDING}" y1="${y + 31}" x2="${PAGE_PADDING + 70}" y2="${y + 31}" stroke="${BLUE}" stroke-width="3" stroke-linecap="round"/></g>`
}

function crewNumber(line: CrewSummaryLine): number | null {
  return Number.isFinite(line.crewNumber) && (line.crewNumber ?? 0) > 0
    ? Math.trunc(line.crewNumber!)
    : null
}

function renderCrewCard(
  line: CrewSummaryLine,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = 14
  const contentWidth = width - padding * 2
  const headingSize = 19
  const number = crewNumber(line)
  const title =
    number !== null
      ? `Equipaggio ${number}`
      : line.category === "empty"
        ? "Barca libera"
        : "Equipaggio"
  const destination = cleanText(line.destination).trim()
  const destinationText =
    line.category === "mezzi" ? "Mezzi" : destination || "Senza barca"
  const destinationLabel = line.category === "mezzi" ? "Destinazione" : "Barca"
  const destinationLines = wrapText(
    `${destinationLabel}: ${destinationText}`,
    contentWidth,
    14,
  )
  let cursorY = y + padding + headingSize + 5
  let inner = `<text x="${x + padding}" y="${y + padding + headingSize}" font-family="${FONT_FAMILY}" font-size="${headingSize}" font-weight="700" fill="#172b47">${escapeXml(title)}</text>`
  inner += renderTextLines(
    destinationLines,
    x + padding,
    cursorY + 14,
    14,
    18,
    'fill="#53667d"',
  )
  cursorY += destinationLines.length * 18 + 6

  const members = Array.isArray(line.members) ? line.members : []
  if (members.length === 0) {
    inner += `<text x="${x + padding}" y="${cursorY + 16}" font-family="${FONT_FAMILY}" font-size="15" fill="#64778a">Nessun allievo assegnato</text>`
    cursorY += 22
  } else {
    members.forEach((member, memberIndex) => {
      const rendered = layoutMember(member, x + padding, cursorY, contentWidth)
      inner += rendered.svg
      cursorY += rendered.height + 2
      if (memberIndex < members.length - 1) {
        inner += `<line x1="${x + padding}" y1="${cursorY}" x2="${x + width - padding}" y2="${cursorY}" stroke="#e5ebf0" stroke-width="1"/>`
        cursorY += 5
      }
    })
  }

  const height = Math.max(82, cursorY - y + padding - 3)
  const crewAttribute = number === null ? "" : ` data-crew-number="${number}"`
  return {
    height,
    svg: `<g data-summary-category="${line.category}"${crewAttribute} aria-label="${escapeXml(title)}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#cfdae7" stroke-width="1.5"/>${inner}</g>`,
  }
}

function renderRosterCard(
  members: CrewSummaryMember[],
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = 14
  const columnGap = 18
  const columns = 2
  const columnWidth = (width - padding * 2 - columnGap) / columns
  const rows: string[] = []
  let cursorY = y + padding

  for (let index = 0; index < members.length; index += columns) {
    const left = members[index]
    const right = members[index + 1]
    const leftLayout = left
      ? layoutMember(left, x + padding, cursorY, columnWidth)
      : null
    const rightLayout = right
      ? layoutMember(
          right,
          x + padding + columnWidth + columnGap,
          cursorY,
          columnWidth,
        )
      : null
    if (leftLayout) rows.push(leftLayout.svg)
    if (rightLayout) rows.push(rightLayout.svg)
    cursorY += Math.max(leftLayout?.height ?? 0, rightLayout?.height ?? 0) + 5
  }

  const height = Math.max(58, cursorY - y + padding - 5)
  return {
    height,
    svg: `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#cfdae7" stroke-width="1.5"/>${rows.join("")}</g>`,
  }
}

function linesForCategory(
  lines: CrewSummaryLine[],
  category: CrewSummaryCategory,
): CrewSummaryLine[] {
  return lines.filter((line) => line.category === category)
}

export function buildCrewSummarySvg(
  title: string,
  lines: CrewSummaryLine[],
): string {
  const safeLines = Array.isArray(lines) ? lines : []
  const orderedCategories = CATEGORY_ORDER.map((category) => ({
    category,
    lines: linesForCategory(safeLines, category),
  }))
  const crewCount = safeLines.filter(
    ({ category }) => category !== "available",
  ).length
  const columns = crewCount > CREW_LIMIT_FOR_TWO_COLUMNS ? 2 : 1
  const width = columns === 1 ? ONE_COLUMN_WIDTH : TWO_COLUMN_WIDTH
  const contentWidth = width - PAGE_PADDING * 2
  const columnWidth =
    columns === 1 ? contentWidth : (contentWidth - COLUMN_GAP) / 2
  const titleLines = wrapText(
    cleanText(title).trim() || "Riepilogo equipaggi",
    contentWidth,
    26,
  )
  const titleLineHeight = 34
  const titleHeight = PAGE_PADDING + titleLines.length * titleLineHeight + 28
  let cursorY = titleHeight
  let content = ""
  let hasAvailableStudents = false

  for (const { category, lines: categoryLines } of orderedCategories) {
    if (categoryLines.length === 0) continue
    const members = categoryLines.flatMap((line) =>
      Array.isArray(line.members) ? line.members : [],
    )
    if (category === "available") {
      hasAvailableStudents = members.some((member) => !member.role)
      if (!members.length) continue
    }
    content += renderSectionHeading(category, cursorY)
    cursorY += 42

    if (category === "available" || category === "a-terra") {
      const rendered = renderRosterCard(
        members,
        PAGE_PADDING,
        cursorY,
        contentWidth,
      )
      content += rendered.svg
      cursorY += rendered.height + 16
      continue
    }

    for (let index = 0; index < categoryLines.length; index += columns) {
      const row = categoryLines.slice(index, index + columns)
      const rendered = row.map((line, offset) =>
        renderCrewCard(
          line,
          PAGE_PADDING + offset * (columnWidth + COLUMN_GAP),
          cursorY,
          columnWidth,
        ),
      )
      content += rendered.map(({ svg }) => svg).join("")
      cursorY += Math.max(...rendered.map(({ height }) => height)) + CARD_GAP
    }
    cursorY += 5
  }

  if (!hasAvailableStudents) {
    cursorY += 2
    content += `<text data-all-assigned-note="true" x="${width / 2}" y="${cursorY + 16}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" font-weight="600" fill="${BLUE}">Tutti gli allievi assegnati</text>`
    cursorY += 32
  }

  const height = Math.max(160, cursorY + PAGE_PADDING)
  const titleSvg = renderTextLines(
    titleLines,
    PAGE_PADDING,
    PAGE_PADDING + 25,
    26,
    titleLineHeight,
    'font-weight="750" fill="#172b47"',
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Riepilogo equipaggi" font-family="${FONT_FAMILY}" data-columns="${columns}"><rect width="${width}" height="${height}" fill="#f2f6fb"/><rect x="${PAGE_PADDING}" y="${PAGE_PADDING + titleLines.length * titleLineHeight + 2}" width="64" height="4" rx="2" fill="${BLUE}"/>${titleSvg}${content}</svg>`
}

function makeFilename(title: string): string {
  const slug = cleanText(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return `${slug || "riepilogo-equipaggi"}.png`
}

function loadImage(url: string): Promise<HTMLImageElement> {
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

export async function buildCrewSummaryPng(
  title: string,
  lines: CrewSummaryLine[],
  options: CrewSummaryOptions = {},
): Promise<Blob> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Il riepilogo PNG richiede un browser compatibile.")
  }
  const svg = buildCrewSummarySvg(title, lines)
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

export async function downloadCrewSummaryPng(
  title: string,
  lines: CrewSummaryLine[],
  options: CrewSummaryOptions = {},
): Promise<void> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error(
      "Il download del riepilogo richiede un browser compatibile.",
    )
  }
  const png = await buildCrewSummaryPng(title, lines, options)
  const url = URL.createObjectURL(png)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = makeFilename(title)
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
