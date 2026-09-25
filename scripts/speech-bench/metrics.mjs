function rotate(items, offset) {
  if (!items.length) return []
  const start = ((offset % items.length) + items.length) % items.length
  return [...items.slice(start), ...items.slice(0, start)]
}

export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function medianPerClipLatency(rows) {
  const clipMedians = rows
    .map((row) => row.medianWarmLatencyMs)
    .filter(Number.isFinite)
  return clipMedians.length ? median(clipMedians) : null
}

export function loopRate(rows) {
  if (!rows.length) return "n/a"
  const looped = rows.filter(
    (row) =>
      String(row.hypothesis).split(/\s+/).filter(Boolean).length >
      row.words * 3,
  ).length
  return ((100 * looped) / rows.length).toFixed(0)
}

export function rotateRoundGroups(groups, roundIndex) {
  return rotate(groups, roundIndex)
}

/**
 * Return a matched round in which every variant sees every entry once.
 * Rotating both clip order and variant order spreads warm-run position effects
 * across variants when the same schedule is repeated.
 */
export function buildRoundSchedule(variants, entries, roundIndex) {
  const indexedEntries = entries.map((entry, entryIndex) => ({
    entry,
    entryIndex,
  }))
  const indexedVariants = variants.map((variant, localIndex) =>
    typeof variant === "string"
      ? { variant, variantIndex: localIndex }
      : variant,
  )

  return rotate(indexedEntries, roundIndex).map(({ entry, entryIndex }) => ({
    entry,
    entryIndex,
    variants: rotate(indexedVariants, roundIndex + entryIndex),
  }))
}
