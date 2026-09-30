import type {
  DutySummaryDay,
  DutySummaryMember,
  DutySummarySections,
} from "@/features/duties/dutySummaryModel"
import {
  ACCENT,
  BG,
  CARD_EDGE_WIDTH,
  CARD_GAP,
  CARD_PADDING,
  COLUMN_GAP,
  FONT_FAMILY,
  MINOR_BG,
  MUTED,
  NAME_FONT,
  NAME_LINE_HEIGHT,
  PAGE_PADDING,
  ROW_GAP,
  WIDTH,
  downloadPngBlob,
  escapeXml,
  layoutMemberRow,
  makeSummaryFilename,
  rasteriseSvgToPng,
  renderCardFrame,
  renderSummaryHeader,
  renderVectorIcon,
  renderWarningBadge,
  type SummaryBadge,
} from "@/lib/summaryImage"

export type {
  DutySummaryDay,
  DutySummaryMember,
  DutySummarySections,
} from "@/features/duties/dutySummaryModel"

export type DutySummaryOptions = {
  /** Output pixel density. The default produces a crisp 2× phone image. */
  pixelRatio?: number
}

/**
 * F3 last part (owner, 2026-09-28): "the summary of the Comandate in a
 * similar format [to the crew summary], using the space of the exported
 * image well." The exporter renders the exact same `DutySummarySections` the
 * read view's `DutySummaryView` shows — the seven duty days in canonical
 * order, two per row, each a card with a 4px coloured edge and a short day
 * label (`01_PRODUCT_SPEC.md` §6.4's own Lun/Mar/Mer/Gio/Ven/Sab/Dom
 * abbreviations) in a fixed left column, the same warm-paper palette — at
 * the same fixed 1080px width as the crew export, height growing to fit all
 * seven days. The generic pieces (palette, header, card frame, text
 * wrapping/badge/row layout, warning badge, rasterisation, download) come
 * from `@/lib/summaryImage`, shared with `crewSummaryImage.ts`; only the
 * Comandate-specific day-card layout lives here.
 */

// The same green `DutyManagement.tsx`'s own P11 list already uses for a
// completed day (`border-[#b8dfbf]` card, `text-[#176b2c]` check icon): reuse
// the app's own "completata" colour rather than inventing a new one.
const COMPLETED_COLOR = "#176b2c"

// Larger than the names, as the boat number is on a crew card, so the day
// leads the card.
const DAY_LABEL_FONT = 40
const DAY_LABEL_COLUMN_WIDTH = 116
// Shorter than the crew card's floor: a day card's left column is a short
// abbreviation, not a two-digit boat number, so it needs less height to
// avoid looking padded on light days.
const CARD_MIN_HEIGHT = CARD_PADDING * 2 + 40

// lucide's `check`, the same icon `DutyManagement.tsx` shows beside a
// completed day's name.
const CHECK_INNER = '<path d="M20 6 9 17l-5-5"/>'

function memberBadges(member: DutySummaryMember): SummaryBadge[] {
  return member.isMinor ? [{ text: "M", fill: MINOR_BG, color: "#ffffff" }] : []
}

function renderDayCard(
  day: DutySummaryDay,
  x: number,
  y: number,
  width: number,
): { svg: string; height: number } {
  const edgeColor = day.completed ? COMPLETED_COLOR : ACCENT
  const contentX = x + CARD_EDGE_WIDTH + CARD_PADDING
  const contentWidth = width - CARD_EDGE_WIDTH - CARD_PADDING * 2
  const textX = contentX + DAY_LABEL_COLUMN_WIDTH
  const textWidth = Math.max(120, contentWidth - DAY_LABEL_COLUMN_WIDTH)

  let cursorY = y + CARD_PADDING
  const rows: string[] = []
  if (day.members.length === 0) {
    rows.push(
      `<text x="${textX}" y="${cursorY + NAME_FONT}" font-family="${FONT_FAMILY}" font-size="24" fill="${MUTED}">Nessun assegnato</text>`,
    )
    cursorY += NAME_LINE_HEIGHT
  } else {
    day.members.forEach((member) => {
      const rendered = layoutMemberRow(
        member.label,
        memberBadges(member),
        textX,
        cursorY,
        textWidth,
      )
      rows.push(rendered.svg)
      cursorY += rendered.height + ROW_GAP
    })
    cursorY -= ROW_GAP
  }

  const height = Math.max(CARD_MIN_HEIGHT, cursorY - y + CARD_PADDING)
  const labelBaseline = y + CARD_PADDING + DAY_LABEL_FONT * 0.78
  // `day.shortLabel` is already the exact "Sab"/"Lun"/… casing
  // `01_PRODUCT_SPEC.md` §6.4 specifies for a day card, unmodified: the read
  // view and this image must show the identical short label, never a
  // re-cased copy that could drift from it.
  let labelSvg = `<text x="${contentX}" y="${labelBaseline}" font-family="${FONT_FAMILY}" font-size="${DAY_LABEL_FONT}" font-weight="800" fill="${edgeColor}">${escapeXml(day.shortLabel)}</text>`
  if (day.completed) {
    labelSvg += renderVectorIcon(
      CHECK_INNER,
      contentX,
      labelBaseline + 8,
      18,
      edgeColor,
      2.6,
    )
  }
  const warningSvg = day.warning
    ? renderWarningBadge(
        day.warning.severity,
        x + width - 60,
        y + 16,
        `Avviso comandata: ${day.warning.severity === "red" ? "rosso" : "giallo"}`,
      )
    : ""

  return {
    height,
    svg: `<g data-summary-day="${day.dayId}" aria-label="${escapeXml(day.label)}, ${day.members.length} assegnati${day.completed ? ", completata" : ""}">${renderCardFrame(x, y, width, height, edgeColor)}${labelSvg}${rows.join("")}${warningSvg}</g>`,
  }
}

/**
 * The pure builder both `buildDutySummaryPng` and its unit tests call: given
 * the shared `DutySummarySections` (the exact same object the read view's
 * `DutySummaryView` renders), it returns the finished SVG markup with no
 * further I/O — no image to load, unlike the crew export's boat logos.
 */
export function buildDutySummarySvg(model: DutySummarySections): string {
  const contentWidth = WIDTH - PAGE_PADDING * 2
  const columnWidth = (contentWidth - COLUMN_GAP) / 2

  const header = renderSummaryHeader({
    eyebrow: "COMANDATE",
    title: model.title,
    fallbackTitle: "Riepilogo comandate",
    contentWidth,
  })
  let cursorY = PAGE_PADDING + header.height
  let content = header.svg

  for (let index = 0; index < model.days.length; index += 2) {
    const leftDay = model.days[index]!
    const rightDay = model.days[index + 1]
    const left = renderDayCard(leftDay, PAGE_PADDING, cursorY, columnWidth)
    const right = rightDay
      ? renderDayCard(
          rightDay,
          PAGE_PADDING + columnWidth + COLUMN_GAP,
          cursorY,
          columnWidth,
        )
      : null
    content += left.svg + (right?.svg ?? "")
    cursorY += Math.max(left.height, right?.height ?? 0)
    if (index + 2 < model.days.length) cursorY += CARD_GAP
  }

  const height = Math.max(320, cursorY + PAGE_PADDING)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="Riepilogo comandate" font-family="${FONT_FAMILY}"><rect width="${WIDTH}" height="${height}" fill="${BG}"/>${content}</svg>`
}

export async function buildDutySummaryPng(
  model: DutySummarySections,
  options: DutySummaryOptions = {},
): Promise<Blob> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error("Il riepilogo PNG richiede un browser compatibile.")
  }
  const svg = buildDutySummarySvg(model)
  return rasteriseSvgToPng(svg, options)
}

export async function downloadDutySummaryPng(
  model: DutySummarySections,
  options: DutySummaryOptions = {},
): Promise<void> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    throw new Error(
      "Il download del riepilogo richiede un browser compatibile.",
    )
  }
  const png = await buildDutySummaryPng(model, options)
  await downloadPngBlob(
    png,
    makeSummaryFilename(model.title, "riepilogo-comandate"),
  )
}
