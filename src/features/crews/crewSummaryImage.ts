export type CrewSummaryMember = {
  label: string
  isMinor: boolean
  duty: "current" | "smontante" | null
}

export type CrewSummaryLine = {
  crewNumber: number
  destination: string
  members: CrewSummaryMember[]
}

const SINGLE_COLUMN_LIMIT = 12
const SINGLE_COLUMN_WIDTH = 1040
const TWO_COLUMN_WIDTH = 1200
const PAGE_PADDING = 28
const COLUMN_GAP = 24
const FONT_FAMILY = "Arial, Helvetica, sans-serif"

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

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

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  const maxCharacters = Math.max(8, Math.floor(maxWidth / (fontSize * 0.58)))
  const lines: string[] = []
  let current = ""

  const pushLongWord = (word: string) => {
    const characters = Array.from(word)
    while (characters.length > maxCharacters) {
      lines.push(characters.splice(0, maxCharacters).join(""))
    }
    return characters.join("")
  }

  for (const word of words) {
    const pieces = word.length > maxCharacters ? [pushLongWord(word)] : [word]
    for (const piece of pieces) {
      if (!piece) continue
      const next = current ? `${current} ${piece}` : piece
      if (Array.from(next).length > maxCharacters && current) {
        lines.push(current)
        current = piece
      } else {
        current = next
      }
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
  options = "",
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${baselineY + index * lineHeight}" font-family="${FONT_FAMILY}" font-size="${fontSize}" ${options}>${escapeXml(line)}</text>`,
    )
    .join("")
}

function renderMarker(
  mark: "C" | "SM" | "M",
  label: "Comandata" | "Smontante" | "Minorenne",
  x: number,
  y: number,
  fill: string,
  color: string,
  stroke = "none",
): { svg: string; width: number } {
  const width = mark === "SM" ? 25 : 18
  const height = 18
  return {
    width,
    svg: `<g role="img" aria-label="${label}"><title>${label}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${stroke === "none" ? 0 : 1.5}"/><text x="${x + width / 2}" y="${y + 12.5}" font-family="${FONT_FAMILY}" text-anchor="middle" font-size="${mark === "SM" ? 8 : 9}" font-weight="900" fill="${color}">${mark}</text></g>`,
  }
}

function renderCrewCard(
  line: CrewSummaryLine,
  index: number,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = 14
  const contentWidth = width - padding * 2
  const titleFontSize = 20
  const destinationFontSize = 15
  const destination = cleanText(line.destination).trim() || "—"
  const destinationLines = wrapText(
    `Destinazione: ${destination}`,
    contentWidth,
    destinationFontSize,
  )
  const members = Array.isArray(line.members) ? line.members : []
  let cursorY = y + padding + titleFontSize
  let inner = `<text x="${x + padding}" y="${cursorY}" font-size="${titleFontSize}" font-weight="700" fill="#17324d">Equipaggio ${Number.isFinite(line.crewNumber) && line.crewNumber > 0 ? Math.trunc(line.crewNumber) : index + 1}</text>`

  cursorY += 8
  inner += renderTextLines(
    destinationLines,
    x + padding,
    cursorY + destinationFontSize,
    destinationFontSize,
    19,
    'fill="#42566b"',
  )
  cursorY += destinationLines.length * 19 + 8

  const visibleMembers = members.length
    ? members
    : [{ label: "Nessun allievo assegnato", isMinor: false, duty: null }]

  visibleMembers.forEach((member, memberIndex) => {
    const label = cleanText(member.label).trim() || "Nome non disponibile"
    const markers: Array<{
      mark: "C" | "SM" | "M"
      label: "Comandata" | "Smontante" | "Minorenne"
      fill: string
      color: string
      stroke?: string
    }> = []
    if (member.duty === "current")
      markers.push({
        mark: "C",
        label: "Comandata",
        fill: "#2f5fa0",
        color: "#ffffff",
      })
    if (member.duty === "smontante")
      markers.push({
        mark: "SM",
        label: "Smontante",
        fill: "#ffffff",
        color: "#2f5fa0",
        stroke: "#2f5fa0",
      })
    if (member.isMinor)
      markers.push({
        mark: "M",
        label: "Minorenne",
        fill: "#b42318",
        color: "#ffffff",
      })

    const markerGap = 4
    const markerWidth = markers.reduce(
      (width, marker) => width + (marker.mark === "SM" ? 25 : 18) + markerGap,
      0,
    )
    const nameWidth = Math.max(
      80,
      contentWidth - (markers.length ? markerWidth + 4 : 0),
    )
    const nameLines = wrapText(label, nameWidth, 18)
    const nameLineHeight = 22
    const rowStart = cursorY
    inner += renderTextLines(
      nameLines,
      x + padding,
      rowStart + 17,
      18,
      nameLineHeight,
      'fill="#172b3f"',
    )

    if (markers.length) {
      let markerX = x + padding + contentWidth - markerWidth + markerGap
      for (const marker of markers) {
        const rendered = renderMarker(
          marker.mark,
          marker.label,
          markerX,
          rowStart + 1,
          marker.fill,
          marker.color,
          marker.stroke,
        )
        inner += rendered.svg
        markerX += rendered.width + markerGap
      }
    }

    cursorY += nameLines.length * nameLineHeight + 4
    cursorY += 5
    if (memberIndex < visibleMembers.length - 1) {
      inner += `<line x1="${x + padding}" y1="${cursorY}" x2="${x + width - padding}" y2="${cursorY}" stroke="#e5ebf0" stroke-width="1"/>`
      cursorY += 8
    }
  })

  const height = Math.max(82, cursorY - y + padding - 5)
  return {
    height,
    svg: `<g data-crew-number="${Number.isFinite(line.crewNumber) && line.crewNumber > 0 ? Math.trunc(line.crewNumber) : index + 1}" aria-label="Equipaggio ${Number.isFinite(line.crewNumber) && line.crewNumber > 0 ? Math.trunc(line.crewNumber) : index + 1}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#d6e0e8" stroke-width="1.5"/>${inner}</g>`,
  }
}

export function buildCrewSummarySvg(
  title: string,
  lines: CrewSummaryLine[],
): string {
  const crews = Array.isArray(lines) ? lines : []
  const columns = crews.length > SINGLE_COLUMN_LIMIT ? 2 : 1
  const width = columns === 1 ? SINGLE_COLUMN_WIDTH : TWO_COLUMN_WIDTH
  const columnWidth =
    columns === 1
      ? width - PAGE_PADDING * 2
      : (width - PAGE_PADDING * 2 - COLUMN_GAP) / 2
  const titleLines = wrapText(
    cleanText(title).trim() || "Riepilogo equipaggi",
    width - PAGE_PADDING * 2,
    28,
  )
  const titleLineHeight = 36
  const headerHeight = PAGE_PADDING + titleLines.length * titleLineHeight + 18
  const cardGap = 12
  const perColumn =
    columns === 1
      ? crews.map((crew, index) => ({ crew, index }))
      : [
          crews
            .slice(0, Math.ceil(crews.length / 2))
            .map((crew, index) => ({ crew, index })),
          crews.slice(Math.ceil(crews.length / 2)).map((crew, offset) => ({
            crew,
            index: offset + Math.ceil(crews.length / 2),
          })),
        ]
  const columnGroups =
    columns === 1
      ? [perColumn as Array<{ crew: CrewSummaryLine; index: number }>]
      : (perColumn as Array<Array<{ crew: CrewSummaryLine; index: number }>>)
  const renderedColumns = columnGroups.map((group, columnIndex) => {
    const x = PAGE_PADDING + columnIndex * (columnWidth + COLUMN_GAP)
    let y = headerHeight
    const cardSvgs: string[] = []
    for (const { crew, index } of group) {
      const rendered = renderCrewCard(crew, index, x, y, columnWidth)
      cardSvgs.push(rendered.svg)
      y += rendered.height + cardGap
    }
    return { svg: cardSvgs.join(""), height: y }
  })
  const height = Math.max(
    headerHeight + 32,
    ...renderedColumns.map((column) => column.height + PAGE_PADDING),
  )
  const titleSvg = renderTextLines(
    titleLines,
    PAGE_PADDING,
    PAGE_PADDING + 28,
    28,
    titleLineHeight,
    'font-weight="700" fill="#123d67"',
  )
  const cardsSvg = renderedColumns.map((column) => column.svg).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Riepilogo equipaggi" font-family="Arial, Helvetica, sans-serif" data-columns="${columns}"><rect width="${width}" height="${height}" fill="#ffffff"/><rect x="${PAGE_PADDING}" y="${PAGE_PADDING + titleLines.length * titleLineHeight + 2}" width="64" height="4" rx="2" fill="#1d6fa5"/>${titleSvg}${cardsSvg}</svg>`
}

function makeFilename(title: string): string {
  const slug = cleanText(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
  return `${slug || "riepilogo-equipaggi"}.svg`
}

export function downloadCrewSummarySvg(
  title: string,
  lines: CrewSummaryLine[],
): void {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error(
      "Il download del riepilogo richiede un browser compatibile.",
    )
  }

  const blob = new Blob([buildCrewSummarySvg(title, lines)], {
    type: "image/svg+xml;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
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
