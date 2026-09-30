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
  allStudentsAssigned,
  crewCardLabel,
  crewLineClassColor,
  groupNumberWidthEm,
  modelOnlyName,
  type CrewSummaryCrewLine,
  type CrewSummaryGroup,
  type CrewSummaryMember,
  type CrewSummarySections,
} from "@/features/crews/crewSummaryModel"
import {
  ACCENT,
  BG,
  BORDER,
  CARD_BG,
  CARD_EDGE_WIDTH,
  CARD_GAP,
  CARD_PADDING,
  COLUMN_GAP,
  FONT_FAMILY,
  INK,
  MINOR_BG,
  MUTED,
  NAME_FONT,
  NAME_LINE_HEIGHT,
  PAGE_PADDING,
  RULE,
  ROW_GAP,
  WARNING_BADGE_OFFSET,
  WARNING_BADGE_RESERVE,
  WARNING_BADGE_TOP,
  WIDTH,
  cleanText,
  downloadPngBlob,
  escapeXml,
  estimateTextWidth,
  layoutMemberRow,
  loadImage,
  makeSummaryFilename,
  rasteriseSvgToPng,
  renderCardFrame,
  renderSummaryHeader,
  renderTextLines,
  renderVectorIcon,
  renderWarningBadge,
  type SummaryBadge,
  wrapText,
} from "@/lib/summaryImage"

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
 *
 * The generic pieces — palette, header block, card frame, text
 * wrapping/badge/row layout, the warning badge and PNG rasterisation/download
 * — live in `@/lib/summaryImage`, shared with the Comandate export
 * (`features/duties/dutySummaryImage.ts`). Only what is genuinely about a
 * crew (boat-model groups and logos, the gommone mark, duty/role badges,
 * available/A terra/empty sections) stays in this file.
 */

// Crew-only marker colours: the *live* `PersonBadges.tsx` colours (the app's
// general `--primary` blue and the amber role chip), not the static mock's
// placeholder blue — the export must match what the read view actually
// renders today, which is the code, not the frozen mock.
const DUTY_BLUE = "#2f5fa0"
const ROLE_BG = "#fff1d6"
const ROLE_FG = "#8a5200"

// The number column is never narrower than this (room for two digits at the
// number's font size, plus a gap before the names), and grows to the widest
// boat number of its group — up to `CARD_NUMBER_MAX_SHARE` of the card's
// content, past which the number shrinks instead of crowding the names out.
const CARD_NUMBER_COLUMN_WIDTH = 92
const CARD_NUMBER_FONT = 54
const CARD_NUMBER_GAP = 20
const CARD_NUMBER_MAX_SHARE = 0.45
const CARD_NUMBER_MIN_FONT = 20
// "<model> · Senza barca", muted, above the names of a crew that is listed
// under its model with no boat chosen yet.
const CAPTION_FONT = 22
const CAPTION_LINE_HEIGHT = 28
const CAPTION_GAP = 8
// Only as tall as the boat number needs: a card grows with its names, and a
// fixed taller floor left most two-person cards half empty.
const CARD_MIN_HEIGHT = CARD_PADDING * 2 + 56

const ALL_ASSIGNED_FONT = 28
const GROUP_GAP = 40
const HEADING_CONTENT_GAP = 20
const GROUP_HEADING_HEIGHT = 64
const GROUP_LOGO_HEIGHT = 52
const GROUP_LOGO_MAX_WIDTH = 300
const SECTION_HEADING_HEIGHT = 56
const SECTION_ICON_SIZE = 30

/**
 * The app's own icon vocabulary this file still owns, redrawn as raw paths so
 * the exporter needs no `<foreignObject>` or icon library at rasterisation
 * time: the gommone draws the exact same `GOMMONE_HULL_PATHS`/
 * `GOMMONE_PROPELLER_PATH` as `GommoneIcon` (`boatMarks.ts`, shared with
 * `BoatIdentity.tsx`). The three section icons (available/A terra/empty) are
 * lucide's `users`, `person-standing` and `sailboat` for visual consistency
 * with the rest of the app, though the task only requires the gommone icon to
 * be pixel-identical. The warning triangle itself now lives in
 * `@/lib/summaryImage`'s `renderWarningBadge`, shared with the Comandate
 * export.
 */
type IconKind = "gommone" | "available" | "a-terra" | "empty"

function renderIcon(
  kind: IconKind,
  x: number,
  y: number,
  size: number,
  color: string,
  orientation: "horizontal" | "vertical" = "horizontal",
): string {
  switch (kind) {
    case "gommone": {
      const transform = gommoneTransform(orientation)
      const hull = GOMMONE_HULL_PATHS.map((d) => `<path d="${d}"/>`).join("")
      const propeller = `<path d="${GOMMONE_PROPELLER_PATH}" stroke-width="${GOMMONE_PROPELLER_STROKE_WIDTH}"/>`
      const inner = transform
        ? `<g transform="${transform}">${hull}${propeller}</g>`
        : `${hull}${propeller}`
      return renderVectorIcon(inner, x, y, size, color, GOMMONE_STROKE_WIDTH)
    }
    case "available":
      return renderVectorIcon(
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
        x,
        y,
        size,
        color,
      )
    case "a-terra":
      return renderVectorIcon(
        '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>',
        x,
        y,
        size,
        color,
      )
    case "empty":
      return renderVectorIcon(
        '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
        x,
        y,
        size,
        color,
      )
  }
}

/** Minor, then duty, then volunteer role — the same order and colours
 *  `AnnouncementCrewCard` renders live (`isMinor`, then `duty`, then
 *  `role`), not the mock's placeholder order or colours. */
function memberBadges(member: CrewSummaryMember): SummaryBadge[] {
  const badges: SummaryBadge[] = []
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

function layoutCrewMemberRow(
  member: CrewSummaryMember,
  x: number,
  y: number,
  width: number,
  reserveFirstLine = 0,
): { svg: string; height: number } {
  return layoutMemberRow(
    member.label,
    memberBadges(member),
    x,
    y,
    width,
    reserveFirstLine,
  )
}

type NumberColumn = { width: number; fontSize: number }

/**
 * The number column every card of a group shares, sized from the widest boat
 * number in that group so the names still line up within it: never narrower
 * than `CARD_NUMBER_COLUMN_WIDTH`, which fits two digits. A longer number
 * (115, 1234, A12) widens it; one too long for even the capped column is drawn
 * smaller rather than over the first name.
 */
export function crewNumberColumn(
  lines: readonly CrewSummaryCrewLine[],
  contentWidth: number,
): NumberColumn {
  const widest = groupNumberWidthEm(lines) * CARD_NUMBER_FONT
  const width = Math.min(
    contentWidth * CARD_NUMBER_MAX_SHARE,
    Math.max(CARD_NUMBER_COLUMN_WIDTH, Math.ceil(widest + CARD_NUMBER_GAP)),
  )
  const room = width - CARD_NUMBER_GAP
  const fontSize =
    widest > room
      ? Math.max(
          CARD_NUMBER_MIN_FONT,
          Math.floor((CARD_NUMBER_FONT * room) / widest),
        )
      : CARD_NUMBER_FONT
  return { width, fontSize }
}

function renderCrewCard(
  line: CrewSummaryCrewLine,
  x: number,
  y: number,
  width: number,
  numberColumn: NumberColumn,
): { svg: string; height: number } {
  const classColor = crewLineClassColor(line)
  const contentX = x + CARD_EDGE_WIDTH + CARD_PADDING
  const contentWidth = width - CARD_EDGE_WIDTH - CARD_PADDING * 2
  const textX = contentX + numberColumn.width
  const textWidth = Math.max(120, contentWidth - numberColumn.width)
  // The corner warning badge is drawn over the card's first text row: that
  // row (the caption, else the first name) stays clear of it.
  let reserve = line.warning ? WARNING_BADGE_RESERVE : 0

  let cursorY = y + CARD_PADDING
  const rows: string[] = []
  const modelOnly = modelOnlyName(line)
  if (modelOnly) {
    const caption = wrapText(
      `${cleanText(modelOnly)} · Senza barca`,
      textWidth,
      CAPTION_FONT,
      Math.max(60, textWidth - reserve),
    )
    rows.push(
      renderTextLines(
        caption,
        textX,
        cursorY + CAPTION_FONT,
        CAPTION_FONT,
        CAPTION_LINE_HEIGHT,
        `data-summary-caption="senza-barca" font-weight="700" fill="${MUTED}"`,
      ),
    )
    cursorY += caption.length * CAPTION_LINE_HEIGHT + CAPTION_GAP
    // The caption ends where the badge does (y + 60), so the names below it
    // are already clear.
    reserve = 0
  }
  if (line.members.length === 0) {
    rows.push(
      `<text x="${textX}" y="${cursorY + NAME_FONT}" font-family="${FONT_FAMILY}" font-size="24" fill="${MUTED}">Nessuno assegnato</text>`,
    )
    cursorY += NAME_LINE_HEIGHT
  } else {
    line.members.forEach((member, index) => {
      const rendered = layoutCrewMemberRow(
        member,
        textX,
        cursorY,
        textWidth,
        index === 0 ? reserve : 0,
      )
      rows.push(rendered.svg)
      cursorY += rendered.height + ROW_GAP
    })
    cursorY -= ROW_GAP
  }

  const height = Math.max(CARD_MIN_HEIGHT, cursorY - y + CARD_PADDING)
  const numberBaseline = y + CARD_PADDING + numberColumn.fontSize * 0.78
  const numberSvg = line.boat
    ? `<text x="${contentX}" y="${numberBaseline}" font-family="${FONT_FAMILY}" font-size="${numberColumn.fontSize}" font-weight="800" fill="${classColor}">${escapeXml(line.boat.number)}</text>`
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
      : // No boat yet: a muted dash, never the class colour a real number
        // wears, so a crew that only knows its model cannot be mistaken for
        // one with a boat.
        `<text x="${contentX}" y="${y + CARD_PADDING + CARD_NUMBER_FONT * 0.78}" font-family="${FONT_FAMILY}" font-size="${CARD_NUMBER_FONT}" font-weight="800" fill="${MUTED}">–</text>`
  const warningSvg = line.warning
    ? renderWarningBadge(
        line.warning.severity,
        x + width - WARNING_BADGE_OFFSET,
        y + WARNING_BADGE_TOP,
        `Avviso equipaggio: ${line.warning.severity === "red" ? "rosso" : "giallo"}`,
      )
    : ""

  return {
    height,
    svg: `<g data-summary-crew-number="${line.crewNumber}" aria-label="Equipaggio ${line.crewNumber}, ${escapeXml(cleanText(crewCardLabel(line)))}">${renderCardFrame(x, y, width, height, classColor)}${numberSvg}${rows.join("")}${warningSvg}</g>`,
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
      ? layoutCrewMemberRow(left, x + padding, cursorY, columnWidth)
      : null
    const rightLayout = right
      ? layoutCrewMemberRow(
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

  // A model's name as text: the fallback for a logo that is missing or failed
  // to load, and the only mark a model outside the known list has.
  const modelNameMark = (name: string) => {
    const text = cleanText(name)
    return {
      svg: `<text x="${PAGE_PADDING}" y="${centerY + 8}" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" fill="${INK}">${escapeXml(text)}</text>`,
      right: PAGE_PADDING + estimateTextWidth(text, 24),
    }
  }

  if (group.kind === "boat" || group.kind === "other-model") {
    const logo = group.kind === "boat" ? logos[group.boatType] : undefined
    if (logo && logo.width > 0 && logo.height > 0) {
      const rawWidth = GROUP_LOGO_HEIGHT * (logo.width / logo.height)
      const markWidth = Math.min(GROUP_LOGO_MAX_WIDTH, rawWidth)
      const markHeight = markWidth * (logo.height / logo.width)
      const markY = y + (GROUP_HEADING_HEIGHT - markHeight) / 2
      markSvg = `<image href="${logo.dataUrl}" x="${PAGE_PADDING}" y="${markY}" width="${markWidth}" height="${markHeight}" preserveAspectRatio="xMidYMid meet"/>`
      markRight = PAGE_PADDING + markWidth
    } else {
      const mark = modelNameMark(
        group.kind === "boat" ? group.boatType : group.modelName,
      )
      markSvg = mark.svg
      markRight = mark.right
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

  const header = renderSummaryHeader({
    eyebrow: "EQUIPAGGI",
    title: model.title,
    fallbackTitle: "Riepilogo equipaggi",
    contentWidth,
  })
  let cursorY = PAGE_PADDING + header.height
  let content = header.svg

  let isFirstBlock = true
  const beforeBlock = () => {
    if (!isFirstBlock) cursorY += GROUP_GAP
    isFirstBlock = false
  }

  // The summary starts with whoever is still available to place (owner,
  // UX1; spec §7.5), then the occupied crews.
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

  const cardContentWidth = columnWidth - CARD_EDGE_WIDTH - CARD_PADDING * 2
  for (const group of model.groups) {
    beforeBlock()
    const heading = renderGroupHeading(group, logos, cursorY, contentWidth)
    content += heading.svg
    cursorY += heading.height + HEADING_CONTENT_GAP
    const numberColumn = crewNumberColumn(group.lines, cardContentWidth)

    for (let index = 0; index < group.lines.length; index += 2) {
      const leftLine = group.lines[index]!
      const rightLine = group.lines[index + 1]
      const left = renderCrewCard(
        leftLine,
        PAGE_PADDING,
        cursorY,
        columnWidth,
        numberColumn,
      )
      const right = rightLine
        ? renderCrewCard(
            rightLine,
            PAGE_PADDING + columnWidth + COLUMN_GAP,
            cursorY,
            columnWidth,
            numberColumn,
          )
        : null
      content += left.svg + (right?.svg ?? "")
      cursorY += Math.max(left.height, right?.height ?? 0)
      if (index + 2 < group.lines.length) cursorY += CARD_GAP
    }
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

  // With no student left to place the summary closes on a small centred
  // note, in the read view's own accent blue.
  if (allStudentsAssigned(model)) {
    beforeBlock()
    content += `<text data-all-assigned-note="true" x="${WIDTH / 2}" y="${cursorY + ALL_ASSIGNED_FONT}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${ALL_ASSIGNED_FONT}" font-weight="700" fill="${ACCENT}">Tutti gli allievi assegnati</text>`
    cursorY += ALL_ASSIGNED_FONT + 6
  }

  const height = Math.max(320, cursorY + PAGE_PADDING)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="Riepilogo equipaggi" font-family="${FONT_FAMILY}"><rect width="${WIDTH}" height="${height}" fill="${BG}"/>${content}</svg>`
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
  return rasteriseSvgToPng(svg, options)
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
  await downloadPngBlob(
    png,
    makeSummaryFilename(model.title, "riepilogo-equipaggi"),
  )
}
