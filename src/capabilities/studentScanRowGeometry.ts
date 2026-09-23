export type StudentScanStructuredField = "dateOfBirth" | "age" | "phone"

export type StudentScanTsvUnresolvedReason =
  | "invalid-geometry"
  | "not-structured-only"
  | "no-name-row"
  | "no-unique-row"
  | "overlapping-columns"
  | "duplicate-field"
  | "staff-row"

export interface StudentScanTsvJoin {
  fragmentSourceId: string
  targetSourceId: string
  fields: StudentScanStructuredField[]
}

export interface StudentScanTsvUnresolvedFragment {
  sourceId: string
  fields: StudentScanStructuredField[]
  reason: StudentScanTsvUnresolvedReason
}

export interface StudentScanTsvReconstruction {
  /** TSV with only uniquely associated structured words reassigned. */
  tsv: string
  joins: StudentScanTsvJoin[]
  unresolved: StudentScanTsvUnresolvedFragment[]
  /** Geometry-only hint; it never removes or changes a name-bearing row. */
  tableBand: StudentScanTsvTableBand
}

export interface StudentScanTsvTableBand {
  supported: boolean
  anchorSourceIds: string[]
  outsideSourceIds: string[]
  medianPitch: number | null
}

interface TsvWord {
  cells: string[]
  sourceLine: number
  sourceId: string
  text: string
  confidence: number
  left: number
  top: number
  right: number
  bottom: number
  centerY: number
  height: number
}

interface TsvLine {
  id: string
  words: TsvWord[]
  text: string
  centerY: number
  height: number
  hasGeometry: boolean
  fields: StudentScanStructuredField[]
  isStructuredOnly: boolean
  isNameBearing: boolean
  isStaffLike: boolean
  hasDuplicateFields: boolean
  left: number
  right: number
}

interface TextFieldMatch {
  field: StudentScanStructuredField
  start: number
  end: number
}

const DATE_PATTERN = /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/gu
const AGE_PATTERN =
  /(?:^|[^\p{L}\p{N}])(?:et[aà]\s*[:=-]?\s*\d{1,2}|\d{1,2}\s+ann[oi])(?=$|[^\p{L}\p{N}])/giu
const PHONE_PATTERN = /(?:\+?39[ .-]*)?(?:\d[ .-]*){9,10}/gu
const STRUCTURED_LABELS = new Set([
  "anno",
  "anni",
  "cell",
  "cellulare",
  "data",
  "eta",
  "età",
  "nascita",
  "nato",
  "nata",
  "tel",
  "telefono",
])
const PERSONNEL_ROLES = new Set([
  "adv",
  "at",
  "capocorso",
  "coordinatore",
  "coordinatrice",
  "ct",
  "direttore",
  "direttrice",
  "is",
  "responsabile",
  "segreteria",
  "staff",
  "assistente",
  "istruttore",
  "istruttrice",
])
const NON_STUDENT_TEXT =
  /\b(?:centro\s+velico|cvc|caprera|corso|settimana|elenco|foglio|pagina|pag\.?|stampa|stampat[oa]|generat[oa]|contatti?|informazioni|firma|note|totale|luned[ìi]|marted[ìi]|mercoled[ìi]|gioved[ìi]|venerd[ìi]|sabato|domenica)\b/iu

function finiteNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getTextMatches(text: string): TextFieldMatch[] {
  const matches: TextFieldMatch[] = []
  for (const [pattern, field] of [
    [DATE_PATTERN, "dateOfBirth"],
    [AGE_PATTERN, "age"],
    [PHONE_PATTERN, "phone"],
  ] as const) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue
      matches.push({
        field,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }
  return matches.sort((left, right) => left.start - right.start)
}

function remainingText(text: string, matches: TextFieldMatch[]) {
  let result = text
  for (const match of [...matches].sort(
    (left, right) => right.start - left.start,
  )) {
    result = `${result.slice(0, match.start)} ${result.slice(match.end)}`
  }
  return result
    .replace(/[^\p{L}'’ -]/gu, " ")
    .split(/\s+/u)
    .map((token) => token.trim().toLocaleLowerCase("it"))
    .filter((token) => token.length > 0 && !STRUCTURED_LABELS.has(token))
}

function roleToken(word: TsvWord) {
  const normalized = word.text.replace(/[^\p{L}]/gu, "").toLocaleLowerCase("it")
  if (!PERSONNEL_ROLES.has(normalized)) return false

  // The existing roster parser treats an all-caps role in the second or later
  // word position as a staff marker. A single role-only line is also useful
  // when Tesseract has split the staff columns into separate lines.
  return (
    word.text.replace(/[^A-Za-z]/g, "") ===
      word.text.replace(/[^A-Za-z]/g, "").toUpperCase() || normalized.length > 2
  )
}

function buildLine(id: string, words: TsvWord[]): TsvLine {
  const text = words.map(({ text: word }) => word).join(" ")
  const matches = getTextMatches(text)
  const fields = matches.map(({ field }) => field)
  const counts = new Map<StudentScanStructuredField, number>()
  for (const field of fields) counts.set(field, (counts.get(field) ?? 0) + 1)
  const hasDuplicateFields = [...counts.values()].some((count) => count > 1)
  const unknownTokens = remainingText(text, matches)
  const roleIndexes = words.flatMap((word, index) =>
    roleToken(word) ? [index] : [],
  )
  const hasRoleAfterName = roleIndexes.some((index) => index > 0)
  const hasRolePrefix = roleIndexes.some((index) => index === 0)
  const hasGeometry = words.every(
    (word) => word.right > word.left && word.bottom > word.top,
  )
  const left = Math.min(...words.map(({ left: wordLeft }) => wordLeft))
  const right = Math.max(...words.map(({ right: wordRight }) => wordRight))
  const centers = words.map(({ centerY }) => centerY)
  const sortedCenters = [...centers].sort(
    (leftCenter, rightCenter) => leftCenter - rightCenter,
  )
  const middle = Math.floor(sortedCenters.length / 2)
  const centerY =
    sortedCenters.length % 2 === 0
      ? ((sortedCenters[middle - 1] ?? 0) + (sortedCenters[middle] ?? 0)) / 2
      : (sortedCenters[middle] ?? 0)
  const heights = words
    .map(({ height }) => height)
    .sort((leftHeight, rightHeight) => leftHeight - rightHeight)
  const height = heights[Math.floor(heights.length / 2)] ?? 0
  const isNameBearing =
    unknownTokens.length >= 2 &&
    !NON_STUDENT_TEXT.test(text) &&
    !hasRoleAfterName &&
    !hasRolePrefix

  return {
    id,
    words,
    text,
    centerY,
    height,
    hasGeometry,
    fields,
    isStructuredOnly: fields.length > 0 && unknownTokens.length === 0,
    isNameBearing,
    isStaffLike: hasRoleAfterName || hasRolePrefix,
    hasDuplicateFields,
    left,
    right,
  }
}

function splitTsv(tsv: string) {
  const newline = tsv.includes("\r\n") ? "\r\n" : "\n"
  const hasTrailingNewline = /(?:\r?\n)$/.test(tsv)
  const sourceLines = tsv.split(/\r?\n/u)
  if (hasTrailingNewline) sourceLines.pop()
  return { newline, hasTrailingNewline, sourceLines }
}

const TESSERACT_TSV_COLUMNS = [
  "level",
  "page_num",
  "block_num",
  "par_num",
  "line_num",
  "word_num",
  "left",
  "top",
  "width",
  "height",
  "conf",
  "text",
]

function rangesOverlap(left: TsvWord, right: TsvWord) {
  return left.left < right.right && right.left < left.right
}

function verticalTolerance(nameRow: TsvLine, fragment: TsvLine) {
  return Math.max(1, Math.min(nameRow.height, fragment.height) * 0.6)
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function diagnoseTableBand(nameRows: TsvLine[]): StudentScanTsvTableBand {
  const sorted = [...nameRows].sort(
    (left, right) => left.centerY - right.centerY,
  )
  let best: { rows: TsvLine[]; pitch: number; deviation: number } | undefined

  // Four or more near-even anchors provide a useful geometry signal. The
  // summary is advisory because a caption or footer can still be regularly
  // spaced; no rows are filtered by this test.
  for (let start = 0; start <= sorted.length - 4; start += 1) {
    for (let end = start + 3; end < sorted.length; end += 1) {
      const rows = sorted.slice(start, end + 1)
      const gaps = rows
        .slice(1)
        .map(
          (row, index) => row.centerY - (rows[index]?.centerY ?? row.centerY),
        )
      const pitch = median(gaps)
      if (pitch <= 0) continue
      const deviation = Math.max(...gaps.map((gap) => Math.abs(gap - pitch)))
      if (deviation > Math.max(3, pitch * 0.12)) continue
      if (
        !best ||
        rows.length > best.rows.length ||
        (rows.length === best.rows.length && deviation < best.deviation)
      ) {
        best = { rows, pitch, deviation }
      }
    }
  }

  if (!best) {
    return {
      supported: false,
      anchorSourceIds: [],
      outsideSourceIds: [],
      medianPitch: null,
    }
  }

  const anchorSourceIds = best.rows.map(({ id }) => id)
  const anchorIds = new Set(anchorSourceIds)
  return {
    supported: true,
    anchorSourceIds,
    outsideSourceIds: sorted
      .filter(({ id }) => !anchorIds.has(id))
      .map(({ id }) => id),
    medianPitch: best.pitch,
  }
}

/**
 * Reassigns a structured-only TSV line to a name line only when its vertical
 * anchor is uniquely close, its x coordinates are disjoint, and no duplicate
 * field or staff-role cue competes with the association. Original word text,
 * confidence, bounding boxes, and all unresolved rows are preserved.
 *
 * Ages must be explicit (`17 anni` or `età 17`). A bare number stays visible
 * as an unclassified TSV line so a table row index cannot be mistaken for age.
 */
export function reconstructStudentScanTsvFragments(
  tsv: string,
): StudentScanTsvReconstruction {
  const { newline, hasTrailingNewline, sourceLines } = splitTsv(tsv)
  const firstRow = sourceLines[0]?.split("\t")
  const unsupported: StudentScanTsvTableBand = {
    supported: false,
    anchorSourceIds: [],
    outsideSourceIds: [],
    medianPitch: null,
  }
  if (!firstRow)
    return { tsv, joins: [], unresolved: [], tableBand: unsupported }
  // Tesseract.js returns headerless TSV; hand-authored fixtures often include
  // the standard header. Both use the same canonical column order.
  const hasHeader = firstRow[0]?.trim() === "level"
  if (
    !hasHeader &&
    (firstRow.length < 12 || !/^[1-5]$/.test(firstRow[0] ?? ""))
  ) {
    return { tsv, joins: [], unresolved: [], tableBand: unsupported }
  }
  const columns = hasHeader ? firstRow : TESSERACT_TSV_COLUMNS
  const indexByName = new Map(
    columns.map((name, index) => [name.trim(), index]),
  )
  const required = [
    "level",
    "page_num",
    "block_num",
    "par_num",
    "line_num",
    "left",
    "top",
    "width",
    "height",
    "conf",
    "text",
  ]
  if (required.some((name) => !indexByName.has(name))) {
    return { tsv, joins: [], unresolved: [], tableBand: unsupported }
  }
  const fieldIndex = (name: string) => indexByName.get(name)!
  const wordGroups = new Map<string, TsvWord[]>()

  const firstDataRow = hasHeader ? 1 : 0
  sourceLines.slice(firstDataRow).forEach((source, sourceOffset) => {
    const cells = source.split("\t")
    if (cells[fieldIndex("level")] !== "5") return
    const text = cells[fieldIndex("text")]?.trim() ?? ""
    if (!text) return
    const sourceId = ["page_num", "block_num", "par_num", "line_num"]
      .map((name) => cells[fieldIndex(name)] ?? "")
      .join(":")
    const left = finiteNumber(cells[fieldIndex("left")])
    const top = finiteNumber(cells[fieldIndex("top")])
    const width = finiteNumber(cells[fieldIndex("width")])
    const height = finiteNumber(cells[fieldIndex("height")])
    const confidence = finiteNumber(cells[fieldIndex("conf")])
    const word: TsvWord = {
      cells,
      sourceLine: sourceOffset + firstDataRow,
      sourceId,
      text,
      confidence: confidence ?? 0,
      left: left ?? 0,
      top: top ?? 0,
      right: (left ?? 0) + (width ?? 0),
      bottom: (top ?? 0) + (height ?? 0),
      centerY: (top ?? 0) + (height ?? 0) / 2,
      height: height ?? 0,
    }
    const group = wordGroups.get(sourceId) ?? []
    group.push(word)
    wordGroups.set(sourceId, group)
  })

  const lines = [...wordGroups].map(([id, words]) => buildLine(id, words))
  const nameRows = lines.filter(
    (line) => line.isNameBearing && line.hasGeometry,
  )
  const tableBand = diagnoseTableBand(nameRows)
  const unresolved: StudentScanTsvUnresolvedFragment[] = []
  const fragments = lines.filter(
    (line) => line.fields.length > 0 && !line.isNameBearing,
  )
  const candidateTargets = new Map<string, TsvLine>()
  const blockedReasons = new Map<string, StudentScanTsvUnresolvedReason>()

  for (const fragment of fragments) {
    if (!fragment.isStructuredOnly) {
      unresolved.push({
        sourceId: fragment.id,
        fields: [...new Set(fragment.fields)],
        reason: "not-structured-only",
      })
      continue
    }
    if (!fragment.hasGeometry) {
      unresolved.push({
        sourceId: fragment.id,
        fields: [...new Set(fragment.fields)],
        reason: "invalid-geometry",
      })
      continue
    }
    if (fragment.hasDuplicateFields) {
      blockedReasons.set(fragment.id, "duplicate-field")
      continue
    }
    if (nameRows.length === 0) {
      blockedReasons.set(fragment.id, "no-name-row")
      continue
    }

    const withDistance = nameRows
      .map((row) => ({
        row,
        distance: Math.abs(fragment.centerY - row.centerY),
      }))
      .sort((left, right) => left.distance - right.distance)
    const closest = withDistance[0]
    if (
      !closest ||
      closest.distance > verticalTolerance(closest.row, fragment)
    ) {
      blockedReasons.set(fragment.id, "no-unique-row")
      continue
    }
    const secondClosest = withDistance[1]
    if (
      secondClosest &&
      secondClosest.distance - closest.distance <
        2 * verticalTolerance(closest.row, fragment)
    ) {
      blockedReasons.set(fragment.id, "no-unique-row")
      continue
    }

    const nearStaffMarker = lines.some((line) => {
      if (!line.isStaffLike || !line.hasGeometry) return false
      if (line.id === closest.row.id) return true
      return (
        Math.abs(line.centerY - closest.row.centerY) <=
          verticalTolerance(closest.row, line) &&
        (line.left >= closest.row.right || line.right <= closest.row.left)
      )
    })
    if (nearStaffMarker) {
      blockedReasons.set(fragment.id, "staff-row")
      continue
    }

    if (closest.row.hasDuplicateFields) {
      blockedReasons.set(fragment.id, "duplicate-field")
      continue
    }
    const targetFields = new Set(closest.row.fields)
    if (fragment.fields.some((field) => targetFields.has(field))) {
      blockedReasons.set(fragment.id, "duplicate-field")
      continue
    }
    if (
      fragment.words.some((fragmentWord) =>
        closest.row.words.some((nameWord) =>
          rangesOverlap(fragmentWord, nameWord),
        ),
      )
    ) {
      blockedReasons.set(fragment.id, "overlapping-columns")
      continue
    }
    candidateTargets.set(fragment.id, closest.row)
  }

  const fragmentsByTargetAndField = new Map<string, TsvLine[]>()
  for (const fragment of fragments) {
    const target = candidateTargets.get(fragment.id)
    if (!target) continue
    for (const field of fragment.fields) {
      const key = `${target.id}\u0000${field}`
      const sameFieldFragments = fragmentsByTargetAndField.get(key) ?? []
      sameFieldFragments.push(fragment)
      fragmentsByTargetAndField.set(key, sameFieldFragments)
    }
  }

  const conflictedFragmentIds = new Set<string>()
  for (const sameFieldFragments of fragmentsByTargetAndField.values()) {
    if (sameFieldFragments.length < 2) continue
    for (const fragment of sameFieldFragments) {
      conflictedFragmentIds.add(fragment.id)
      blockedReasons.set(fragment.id, "duplicate-field")
    }
  }

  const joins: StudentScanTsvJoin[] = []
  for (const fragment of fragments) {
    const target = candidateTargets.get(fragment.id)
    const blockedReason = blockedReasons.get(fragment.id)
    if (blockedReason) {
      unresolved.push({
        sourceId: fragment.id,
        fields: [...new Set(fragment.fields)],
        reason: blockedReason,
      })
      continue
    }
    if (!target || conflictedFragmentIds.has(fragment.id)) continue

    const targetParts = target.id.split(":")
    for (const word of fragment.words) {
      for (const name of ["block_num", "par_num", "line_num"]) {
        const idPart = name === "block_num" ? 1 : name === "par_num" ? 2 : 3
        word.cells[fieldIndex(name)] =
          targetParts[idPart] ?? word.cells[fieldIndex(name)] ?? ""
      }
    }
    joins.push({
      fragmentSourceId: fragment.id,
      targetSourceId: target.id,
      fields: [...new Set(fragment.fields)],
    })
  }

  if (joins.length === 0) return { tsv, joins, unresolved, tableBand }
  const output = [...sourceLines]
  for (const line of lines) {
    for (const word of line.words) {
      output[word.sourceLine] = word.cells.join("\t")
    }
  }
  return {
    tsv: `${output.join(newline)}${hasTrailingNewline ? newline : ""}`,
    joins,
    unresolved,
    tableBand,
  }
}
