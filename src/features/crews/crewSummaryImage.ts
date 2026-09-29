import {
  BOAT_LOGOS,
  GOMMONE_HULL_PATHS,
  GOMMONE_PROPELLER_PATH,
  GOMMONE_PROPELLER_STROKE_WIDTH,
  GOMMONE_STROKE_WIDTH,
  gommoneTransform,
} from "@/features/boats/boatMarks"
import type { BoatType } from "@/domain/config"
import {
  crewLineClassColor,
  type CrewSummaryCrewLine,
  type CrewSummaryGroup,
  type CrewSummaryMember,
  type CrewSummarySections,
} from "@/features/crews/crewSummaryModel"

export type {
  CrewSummaryCrewLine,
  CrewSummaryGroup,
  CrewSummaryMember,
  CrewSummarySections,
} from "@/features/crews/crewSummaryModel"

export type CrewSummaryOptions = {
  /** Output pixel density. The default produces a crisp 2× phone image. */
  pixelRatio?: number
}

/**
 * F3, second half (owner, 2026-09-28): "a screenshot of the crews", not the
 * card-per-crew flyer this replaced. The exporter now renders the exact same
 * `CrewSummarySections` the read view's `AnnouncementView` shows — same
 * boat-model grouping in canonical order, same 4px class-colour edge, same
 * bold class-colour boat number in a fixed left column, same warm-paper
 * palette — at a fixed 1080px width so it reads well shared on a phone, with
 * the height growing to fit every crew on one tall image however many there
 * are. Class-logo PNGs are embedded as data URLs so the SVG carries them with
 * no further network fetch once rasterised; a model whose logo fails to load
 * falls back to its name as text, same as `BoatModelHeaderMark` on screen.
 */

const WIDTH = 1080
const PAGE_PADDING = 40
const COLUMN_GAP = 24
const CARD_GAP = 24
const GROUP_GAP = 40
const HEADING_CONTENT_GAP = 20

const FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

// The read view's own warm-paper palette (`AnnouncementView` in
// CrewManagement.tsx), not the app's general `--background`/`--primary`: the
// exported image is a screenshot of that view, so it uses the same colours.
const BG = "#fffdf8"
const INK = "#102f3b"
const ACCENT = "#0b526b"
const BORDER = "#c8d7db"
const RULE = "#dbe4e6"
const MUTED = "#6b8790"
const CARD_BG = "#ffffff"
// The two marker colours below are the *live* `PersonBadges.tsx` colours
// (the app's general `--primary` blue and the amber role chip), not the
// static mock's placeholder blue — the export must match what the read view
// actually renders today, which is the code, not the frozen mock.
const DUTY_BLUE = "#2f5fa0"
const ROLE_BG = "#fff1d6"
const ROLE_FG = "#8a5200"
const MINOR_BG = "#b42318"
const WARNING_YELLOW_BG = "#fff3cd"
const WARNING_YELLOW_FG = "#8a5a00"
const WARNING_RED_BG = "#fee4e2"
const WARNING_RED_FG = "#b42318"

const NAME_FONT = 32
const NAME_LINE_HEIGHT = 40
const BADGE_HEIGHT = 32
const BADGE_FONT = 18
const BADGE_GAP = 8
const ROW_GAP = 16

const CARD_EDGE_WIDTH = 8
const CARD_PADDING = 24
const CARD_NUMBER_COLUMN_WIDTH = 92
const CARD_NUMBER_FONT = 54
// Only as tall as the boat number needs: a card grows with its names, and a
// fixed taller floor left most two-person cards half empty.
const CARD_MIN_HEIGHT = CARD_PADDING * 2 + 56

const GROUP_HEADING_HEIGHT = 64
const GROUP_LOGO_HEIGHT = 52
const GROUP_LOGO_MAX_WIDTH = 300
const SECTION_HEADING_HEIGHT = 56
const SECTION_ICON_SIZE = 30

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
    result += validXmlCharacter ? character : "�"
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

function estimateTextWidth(text: string, fontSize: number): number {
  return Array.from(text).length * fontSize * 0.58
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

/**
 * The app's own icon vocabulary, redrawn as raw paths so the exporter needs
 * no `<foreignObject>` or icon library at rasterisation time: the gommone
 * draws the exact same `GOMMONE_HULL_PATHS`/`GOMMONE_PROPELLER_PATH` as
 * `GommoneIcon` (`boatMarks.ts`, shared with `BoatIdentity.tsx`), and the
 * warning triangle is lucide's `triangle-alert`, the same one
 * `AnnouncementCrewCard` uses. The three section icons (available/A
 * terra/empty) are lucide's `users`, `person-standing` and `sailboat` for
 * visual consistency with the rest of the app, though the task only requires
 * the gommone and warning icons to be pixel-identical.
 */
type IconKind = "warning" | "gommone" | "available" | "a-terra" | "empty"

function renderIcon(
  kind: IconKind,
  x: number,
  y: number,
  size: number,
  color: string,
  orientation: "horizontal" | "vertical" = "horizontal",
): string {
  const scale = size / 24
  const wrap = (inner: string, strokeWidth = 2) =>
    `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
  switch (kind) {
    case "warning":
      return wrap(
        '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      )
    case "gommone": {
      const transform = gommoneTransform(orientation)
      const hull = GOMMONE_HULL_PATHS.map((d) => `<path d="${d}"/>`).join("")
      const propeller = `<path d="${GOMMONE_PROPELLER_PATH}" stroke-width="${GOMMONE_PROPELLER_STROKE_WIDTH}"/>`
      const inner = transform
        ? `<g transform="${transform}">${hull}${propeller}</g>`
        : `${hull}${propeller}`
      return wrap(inner, GOMMONE_STROKE_WIDTH)
    }
    case "available":
      return wrap(
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
      )
    case "a-terra":
      return wrap(
        '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>',
      )
    case "empty":
      return wrap(
        '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
      )
  }
}

type Badge = { text: string; fill: string; color: string; stroke?: string }

/** Minor, then duty, then volunteer role — the same order and colours
 *  `AnnouncementCrewCard` renders live (`isMinor`, then `duty`, then
 *  `role`), not the mock's placeholder order or colours. */
function memberBadges(member: CrewSummaryMember): Badge[] {
  const badges: Badge[] = []
  if (member.isMinor) {
    badges.push({ text: "M", fill: MINOR_BG, color: "#ffffff" })
  }
  if (member.duty === "current") {
    badges.push({ text: "C", fill: DUTY_BLUE, color: "#ffffff" })
  } else if (member.duty === "smontante") {
    badges.push({
      text: "SM",
      fill: "#ffffff",
      color: DUTY_BLUE,
      stroke: DUTY_BLUE,
    })
  }
  if (member.role) {
    badges.push({ text: member.role, fill: ROLE_BG, color: ROLE_FG })
  }
  return badges
}

function badgeWidth(text: string): number {
  return Math.max(34, Math.round(text.length * BADGE_FONT * 0.62) + 20)
}

function renderBadges(
  badges: Badge[],
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

function layoutMemberRow(
  member: CrewSummaryMember,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const badges = memberBadges(member)
  const badgesWidth = badges.reduce(
    (sum, badge, index) =>
      sum + badgeWidth(badge.text) + (index ? BADGE_GAP : 0),
    0,
  )
  const nameWidth = Math.max(100, width - badgesWidth - (badgesWidth ? 20 : 0))
  const label = cleanText(member.label).trim() || "Nome non disponibile"
  const nameLines = wrapText(label, nameWidth, NAME_FONT)
  const height = Math.max(NAME_LINE_HEIGHT, nameLines.length * NAME_LINE_HEIGHT)
  const nameSvg = renderTextLines(
    nameLines,
    x,
    y + NAME_FONT,
    NAME_FONT,
    NAME_LINE_HEIGHT,
    `font-weight="700" fill="${INK}"`,
  )
  const badgeSvg = badges.length
    ? renderBadges(
        badges,
        x + width - badgesWidth,
        y + (NAME_LINE_HEIGHT - BADGE_HEIGHT) / 2,
      ).svg
    : ""

  return {
    svg: `<g data-member-label="${escapeXml(label)}">${nameSvg}${badgeSvg}</g>`,
    height,
  }
}

function renderWarningBadge(
  severity: "red" | "yellow",
  x: number,
  y: number,
): string {
  const size = 44
  const bg = severity === "red" ? WARNING_RED_BG : WARNING_YELLOW_BG
  const fg = severity === "red" ? WARNING_RED_FG : WARNING_YELLOW_FG
  const iconSize = 24
  return `<g aria-label="Avviso equipaggio: ${severity === "red" ? "rosso" : "giallo"}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="14" fill="${bg}"/>${renderIcon("warning", x + (size - iconSize) / 2, y + (size - iconSize) / 2, iconSize, fg)}</g>`
}

function renderCrewCard(
  line: CrewSummaryCrewLine,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const classColor = crewLineClassColor(line)
  const contentX = x + CARD_EDGE_WIDTH + CARD_PADDING
  const contentWidth = width - CARD_EDGE_WIDTH - CARD_PADDING * 2
  const textX = contentX + CARD_NUMBER_COLUMN_WIDTH
  const textWidth = Math.max(120, contentWidth - CARD_NUMBER_COLUMN_WIDTH)

  let cursorY = y + CARD_PADDING
  const rows: string[] = []
  if (line.members.length === 0) {
    rows.push(
      `<text x="${textX}" y="${cursorY + NAME_FONT}" font-family="${FONT_FAMILY}" font-size="24" fill="${MUTED}">Nessuno assegnato</text>`,
    )
    cursorY += NAME_LINE_HEIGHT
  } else {
    line.members.forEach((member) => {
      const rendered = layoutMemberRow(member, textX, cursorY, textWidth)
      rows.push(rendered.svg)
      cursorY += rendered.height + ROW_GAP
    })
    cursorY -= ROW_GAP
  }

  const height = Math.max(CARD_MIN_HEIGHT, cursorY - y + CARD_PADDING)
  const numberSvg = line.boat
    ? `<text x="${contentX}" y="${y + CARD_PADDING + CARD_NUMBER_FONT * 0.78}" font-family="${FONT_FAMILY}" font-size="${CARD_NUMBER_FONT}" font-weight="800" fill="${classColor}">${escapeXml(line.boat.number)}</text>`
    : line.destination === "mezzi"
      ? // Vertical, bow up — same orientation `AnnouncementCrewCard` gives
        // `GommoneIcon` in the boat-number column of a Mezzi card.
        renderIcon(
          "gommone",
          contentX,
          y + CARD_PADDING + 4,
          46,
          classColor,
          "vertical",
        )
      : `<text x="${contentX}" y="${y + CARD_PADDING + CARD_NUMBER_FONT * 0.78}" font-family="${FONT_FAMILY}" font-size="${CARD_NUMBER_FONT}" font-weight="800" fill="${classColor}">–</text>`
  const warningSvg = line.warning
    ? renderWarningBadge(line.warning.severity, x + width - 60, y + 16)
    : ""
  const cardLabel = line.boat
    ? `${line.boat.type} ${line.boat.number}`
    : line.destination === "mezzi"
      ? "Mezzi"
      : "Senza barca"

  return {
    height,
    svg: `<g data-summary-crew-number="${line.crewNumber}" aria-label="Equipaggio ${line.crewNumber}, ${escapeXml(cardLabel)}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/><rect x="${x}" y="${y}" width="${CARD_EDGE_WIDTH}" height="${height}" fill="${classColor}"/>${numberSvg}${rows.join("")}${warningSvg}</g>`,
  }
}

function renderRosterCard(
  members: CrewSummaryMember[],
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = CARD_PADDING
  const columnGap = 36
  const columnWidth = (width - padding * 2 - columnGap) / 2
  let cursorY = y + padding
  const rows: string[] = []

  for (let index = 0; index < members.length; index += 2) {
    const left = members[index]
    const right = members[index + 1]
    const leftLayout = left
      ? layoutMemberRow(left, x + padding, cursorY, columnWidth)
      : null
    const rightLayout = right
      ? layoutMemberRow(
          right,
          x + padding + columnWidth + columnGap,
          cursorY,
          columnWidth,
        )
      : null
    if (leftLayout) rows.push(leftLayout.svg)
    if (rightLayout) rows.push(rightLayout.svg)
    cursorY +=
      Math.max(leftLayout?.height ?? 0, rightLayout?.height ?? 0) + ROW_GAP
  }

  const height = Math.max(120, cursorY - ROW_GAP - y + padding)
  return {
    height,
    svg: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2"/>${rows.join("")}`,
  }
}

function renderLabelListCard(
  labels: string[],
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const padding = CARD_PADDING
  const columnGap = 36
  const columnWidth = (width - padding * 2 - columnGap) / 2
  const fontSize = 26
  const lineHeight = 34
  let cursorY = y + padding
  const rows: string[] = []

  for (let index = 0; index < labels.length; index += 2) {
    const left = labels[index]
    const right = labels[index + 1]
    const leftLines = left
      ? wrapText(cleanText(left), columnWidth, fontSize)
      : []
    const rightLines = right
      ? wrapText(cleanText(right), columnWidth, fontSize)
      : []
    if (left) {
      rows.push(
        renderTextLines(
          leftLines,
          x + padding,
          cursorY + fontSize,
          fontSize,
          lineHeight,
          `font-weight="700" fill="${MUTED}"`,
        ),
      )
    }
    if (right) {
      rows.push(
        renderTextLines(
          rightLines,
          x + padding + columnWidth + columnGap,
          cursorY + fontSize,
          fontSize,
          lineHeight,
          `font-weight="700" fill="${MUTED}"`,
        ),
      )
    }
    cursorY +=
      Math.max(leftLines.length, rightLines.length, 1) * lineHeight + ROW_GAP
  }

  const height = Math.max(100, cursorY - ROW_GAP - y + padding)
  return {
    height,
    svg: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="2" stroke-dasharray="10 8"/>${rows.join("")}`,
  }
}

/** A logo already decoded to a data URL, with its intrinsic size so the
 *  group heading can size the mark at a fixed height without distortion. */
export type LoadedLogo = { dataUrl: string; width: number; height: number }

function renderGroupHeading(
  group: CrewSummaryGroup,
  logos: Partial<Record<BoatType, LoadedLogo>>,
  y: number,
  contentWidth: number,
): { svg: string; height: number } {
  const centerY = y + GROUP_HEADING_HEIGHT / 2
  let markSvg: string
  let markRight: number

  if (group.kind === "boat") {
    const logo = logos[group.boatType]
    if (logo && logo.width > 0 && logo.height > 0) {
      const rawWidth = GROUP_LOGO_HEIGHT * (logo.width / logo.height)
      const markWidth = Math.min(GROUP_LOGO_MAX_WIDTH, rawWidth)
      const markHeight = markWidth * (logo.height / logo.width)
      const markY = y + (GROUP_HEADING_HEIGHT - markHeight) / 2
      markSvg = `<image href="${logo.dataUrl}" x="${PAGE_PADDING}" y="${markY}" width="${markWidth}" height="${markHeight}" preserveAspectRatio="xMidYMid meet"/>`
      markRight = PAGE_PADDING + markWidth
    } else {
      const text = escapeXml(group.boatType)
      markSvg = `<text x="${PAGE_PADDING}" y="${centerY + 8}" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" fill="${INK}">${text}</text>`
      markRight = PAGE_PADDING + estimateTextWidth(group.boatType, 24)
    }
  } else if (group.kind === "mezzi") {
    const label = "MEZZI"
    markSvg = `${renderIcon("gommone", PAGE_PADDING, centerY - 18, 36, ACCENT)}<text x="${PAGE_PADDING + 48}" y="${centerY + 8}" font-family="${FONT_FAMILY}" font-size="22" font-weight="800" letter-spacing="1.5" fill="${ACCENT}">${label}</text>`
    markRight =
      PAGE_PADDING + 48 + estimateTextWidth(label, 22) + 1.5 * label.length
  } else {
    const label = "EQUIPAGGI SENZA BARCA"
    markSvg = `<text x="${PAGE_PADDING}" y="${centerY + 8}" font-family="${FONT_FAMILY}" font-size="22" font-weight="800" letter-spacing="1.5" fill="${ACCENT}">${label}</text>`
    markRight = PAGE_PADDING + estimateTextWidth(label, 22) + 1.5 * label.length
  }

  const count = group.lines.length
  const countSvg = `<text x="${PAGE_PADDING + contentWidth}" y="${centerY + 7}" text-anchor="end" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="${MUTED}">${count}</text>`
  const ruleX1 = markRight + 20
  const ruleX2 = PAGE_PADDING + contentWidth - 56
  const ruleSvg =
    ruleX2 > ruleX1
      ? `<line x1="${ruleX1}" y1="${centerY}" x2="${ruleX2}" y2="${centerY}" stroke="${RULE}" stroke-width="2"/>`
      : ""

  return {
    svg: `<g data-summary-group="${group.kind}">${markSvg}${ruleSvg}${countSvg}</g>`,
    height: GROUP_HEADING_HEIGHT,
  }
}

function renderSectionHeading(
  label: string,
  count: number,
  icon: IconKind,
  y: number,
  contentWidth: number,
): { svg: string; height: number } {
  const centerY = y + SECTION_HEADING_HEIGHT / 2
  const iconSvg = renderIcon(
    icon,
    PAGE_PADDING,
    centerY - SECTION_ICON_SIZE / 2,
    SECTION_ICON_SIZE,
    ACCENT,
  )
  const labelText = label.toLocaleUpperCase("it-IT")
  const labelX = PAGE_PADDING + SECTION_ICON_SIZE + 14
  const labelSvg = `<text x="${labelX}" y="${centerY + 8}" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" letter-spacing="1.2" fill="${ACCENT}">${escapeXml(labelText)}</text>`
  const labelWidth = estimateTextWidth(labelText, 24) + 1.2 * labelText.length
  const countSvg = `<text x="${PAGE_PADDING + contentWidth}" y="${centerY + 7}" text-anchor="end" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="${MUTED}">${count}</text>`
  const ruleX1 = labelX + labelWidth + 20
  const ruleX2 = PAGE_PADDING + contentWidth - 56
  const ruleSvg =
    ruleX2 > ruleX1
      ? `<line x1="${ruleX1}" y1="${centerY}" x2="${ruleX2}" y2="${centerY}" stroke="${RULE}" stroke-width="2"/>`
      : ""

  return {
    svg: `<g data-summary-section="${escapeXml(label)}">${iconSvg}${labelSvg}${ruleSvg}${countSvg}</g>`,
    height: SECTION_HEADING_HEIGHT,
  }
}

/**
 * The pure builder both `buildCrewSummaryPng` and its unit tests call: given
 * the shared `CrewSummarySections` (the exact same object the read view's
 * `AnnouncementView` renders) and any boat-model logos already decoded to
 * data URLs, it returns the finished SVG markup with no further I/O. A
 * missing logo entry renders the model name as text instead, exactly like
 * `BoatModelHeaderMark`'s own `onError` fallback.
 */
export function buildCrewSummarySvg(
  model: CrewSummarySections,
  logos: Partial<Record<BoatType, LoadedLogo>> = {},
): string {
  const contentWidth = WIDTH - PAGE_PADDING * 2
  const columnWidth = (contentWidth - COLUMN_GAP) / 2

  let cursorY = PAGE_PADDING
  let content = ""

  content += `<text x="${PAGE_PADDING}" y="${cursorY + 24}" font-family="${FONT_FAMILY}" font-size="26" font-weight="800" letter-spacing="3" fill="${INK}">EQUIPAGGI</text>`
  cursorY += 50
  const titleText = cleanText(model.title).trim() || "Riepilogo equipaggi"
  const titleLines = wrapText(titleText, contentWidth, 58)
  content += renderTextLines(
    titleLines,
    PAGE_PADDING,
    cursorY + 50,
    58,
    66,
    `font-weight="800" fill="${INK}"`,
  )
  cursorY += titleLines.length * 66 + 22
  content += `<line x1="${PAGE_PADDING}" y1="${cursorY}" x2="${WIDTH - PAGE_PADDING}" y2="${cursorY}" stroke="${BORDER}" stroke-width="2"/>`
  cursorY += 44

  let isFirstBlock = true
  const beforeBlock = () => {
    if (!isFirstBlock) cursorY += GROUP_GAP
    isFirstBlock = false
  }

  for (const group of model.groups) {
    beforeBlock()
    const heading = renderGroupHeading(group, logos, cursorY, contentWidth)
    content += heading.svg
    cursorY += heading.height + HEADING_CONTENT_GAP

    for (let index = 0; index < group.lines.length; index += 2) {
      const leftLine = group.lines[index]!
      const rightLine = group.lines[index + 1]
      const left = renderCrewCard(leftLine, PAGE_PADDING, cursorY, columnWidth)
      const right = rightLine
        ? renderCrewCard(
            rightLine,
            PAGE_PADDING + columnWidth + COLUMN_GAP,
            cursorY,
            columnWidth,
          )
        : null
      content += left.svg + (right?.svg ?? "")
      cursorY += Math.max(left.height, right?.height ?? 0)
      if (index + 2 < group.lines.length) cursorY += CARD_GAP
    }
  }

  if (model.availableMembers.length > 0) {
    beforeBlock()
    const heading = renderSectionHeading(
      "Persone disponibili",
      model.availableMembers.length,
      "available",
      cursorY,
      contentWidth,
    )
    content += heading.svg
    cursorY += heading.height + HEADING_CONTENT_GAP
    const card = renderRosterCard(
      model.availableMembers,
      PAGE_PADDING,
      cursorY,
      contentWidth,
    )
    content += card.svg
    cursorY += card.height
  }

  if (model.landMembers.length > 0) {
    beforeBlock()
    const heading = renderSectionHeading(
      "A terra",
      model.landMembers.length,
      "a-terra",
      cursorY,
      contentWidth,
    )
    content += heading.svg
    cursorY += heading.height + HEADING_CONTENT_GAP
    const card = renderRosterCard(
      model.landMembers,
      PAGE_PADDING,
      cursorY,
      contentWidth,
    )
    content += card.svg
    cursorY += card.height
  }

  if (model.emptyLabels.length > 0) {
    beforeBlock()
    const heading = renderSectionHeading(
      "Barche ed equipaggi vuoti",
      model.emptyLabels.length,
      "empty",
      cursorY,
      contentWidth,
    )
    content += heading.svg
    cursorY += heading.height + HEADING_CONTENT_GAP
    const card = renderLabelListCard(
      model.emptyLabels,
      PAGE_PADDING,
      cursorY,
      contentWidth,
    )
    content += card.svg
    cursorY += card.height
  }

  const height = Math.max(320, cursorY + PAGE_PADDING)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="Riepilogo equipaggi" font-family="${FONT_FAMILY}"><rect width="${WIDTH}" height="${height}" fill="${BG}"/>${content}</svg>`
}

function makeFilename(title: string): string {
  const slug = cleanText(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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

/**
 * Decodes a same-origin boat-model logo through an offscreen canvas and
 * reads it back as a data URL, so the final SVG carries the pixels inline
 * instead of an external reference the rasteriser would have to fetch a
 * second time. Same-origin only (`boatMarks.ts`'s `BOAT_LOGOS`), so the
 * canvas is never tainted. Any failure — missing file, decode error, no 2D
 * context — resolves to `null` rather than rejecting, so one bad logo never
 * blocks the whole export; the caller falls back to text for that model.
 */
async function loadBoatLogo(type: BoatType): Promise<LoadedLogo | null> {
  try {
    const image = await loadImage(BOAT_LOGOS[type])
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return null
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL("image/png"), width, height }
  } catch {
    return null
  }
}

async function loadBoatLogos(
  model: CrewSummarySections,
): Promise<Partial<Record<BoatType, LoadedLogo>>> {
  const boatTypes = Array.from(
    new Set(
      model.groups
        .filter(
          (group): group is Extract<CrewSummaryGroup, { kind: "boat" }> =>
            group.kind === "boat",
        )
        .map((group) => group.boatType),
    ),
  )
  const entries = await Promise.all(
    boatTypes.map(async (type) => [type, await loadBoatLogo(type)] as const),
  )
  const logos: Partial<Record<BoatType, LoadedLogo>> = {}
  for (const [type, logo] of entries) {
    if (logo) logos[type] = logo
  }
  return logos
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
  model: CrewSummarySections,
  options: CrewSummaryOptions = {},
): Promise<Blob> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Il riepilogo PNG richiede un browser compatibile.")
  }
  const logos = await loadBoatLogos(model)
  const svg = buildCrewSummarySvg(model, logos)
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
  model: CrewSummarySections,
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
  const png = await buildCrewSummaryPng(model, options)
  const url = URL.createObjectURL(png)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = makeFilename(model.title)
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
