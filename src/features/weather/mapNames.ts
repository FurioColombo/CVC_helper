/** A box on the map, in pixels from its top left corner. */
export type Box = { left: number; top: number; right: number; bottom: number }
export type Spot = { left: number; top: number }

const GAP = 3

function boxAt(spot: Spot, width: number, height: number): Box {
  return {
    left: spot.left,
    top: spot.top,
    right: spot.left + width,
    bottom: spot.top + height,
  }
}

function overlap(a: Box, b: Box) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

function covered(box: Box, taken: readonly Box[]) {
  return taken.reduce((sum, other) => sum + overlap(box, other), 0)
}

function within(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high)
}

/**
 * Puts each place's marker over its point: the arrow on the point where it
 * fits, else the marker slid along or across it, the point always under the
 * marker, so that no marker covers another or what is already drawn.
 */
export function placeMarks(
  frame: { width: number; height: number },
  marks: readonly {
    key: string
    /** The point, in pixels. */
    x: number
    y: number
    width: number
    height: number
    /** From the marker's left edge to the middle of its arrow. */
    arrow: number
  }[],
  fixed: readonly Box[],
): Record<string, Spot> {
  const taken = [...fixed]
  const spots: Record<string, Spot> = {}
  for (const mark of marks) {
    const { x, y, width, height, arrow } = mark
    const lefts = [x - arrow, x - width / 2, x - width + arrow]
    const tops = [y - height / 2, y - height * 0.2, y - height * 0.8]
    let best: { spot: Spot; cost: number } | null = null
    search: for (const top of tops) {
      for (const left of lefts) {
        const spot = {
          left: within(left, GAP, frame.width - width - GAP),
          top: within(top, GAP, frame.height - height - GAP),
        }
        const box = boxAt(spot, width, height)
        const holds =
          x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
        const cost = (holds ? 0 : 1e9) + covered(box, taken)
        if (!best || cost < best.cost) best = { spot, cost }
        if (cost === 0) break search
      }
    }
    if (!best) continue
    spots[mark.key] = best.spot
    taken.push(boxAt(best.spot, width, height))
  }
  return spots
}

/**
 * Puts each name against its own mark: under it, over it, or beside it, slid
 * along that side as little as needed to stay inside the map and cover no
 * mark and no name already placed; failing that, where it covers least.
 */
export function placeNames(
  frame: { width: number; height: number },
  marks: ReadonlyMap<string, Box>,
  names: readonly Name[],
): Record<string, Spot> {
  // A name that found no free place goes first next time, while that helps.
  let order = [...names]
  let result = placeInOrder(frame, marks, order)
  for (let round = 0; round < names.length && result.covering.length; round++) {
    const first = new Set(result.covering)
    order = [
      ...order.filter((name) => first.has(name.key)),
      ...order.filter((name) => !first.has(name.key)),
    ]
    const next = placeInOrder(frame, marks, order)
    if (next.cost < result.cost) result = next
  }
  return result.spots
}

type Name = { key: string; width: number; height: number }

function placeInOrder(
  frame: { width: number; height: number },
  marks: ReadonlyMap<string, Box>,
  names: readonly Name[],
) {
  const taken = [...marks.values()]
  const spots: Record<string, Spot> = {}
  const covering: string[] = []
  let total = 0
  for (const name of names) {
    const mark = marks.get(name.key)
    if (!mark) continue
    const { width, height } = name
    const middleX = (mark.left + mark.right) / 2 - width / 2
    const middleY = (mark.top + mark.bottom) / 2 - height / 2
    // Each side keeps the name touching its mark: slides stop short of losing it.
    const along = (low: number, high: number, middle: number) => {
      const steps = [middle]
      for (let at = low; at <= high; at += 3) steps.push(at)
      return steps.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
    }
    const xs = along(mark.left - width + 8, mark.right - 8, middleX)
    const ys = along(mark.top - height + 6, mark.bottom - 6, middleY)
    const sides = {
      below: xs.map((x) => ({
        left: x,
        top: mark.bottom + GAP,
        from: middleX,
      })),
      above: xs.map((x) => ({
        left: x,
        top: mark.top - height - GAP,
        from: middleX,
      })),
      right: ys.map((y) => ({ left: mark.right + GAP, top: y, from: middleY })),
      left: ys.map((y) => ({
        left: mark.left - width - GAP,
        top: y,
        from: middleY,
      })),
    }
    const order =
      name.key === "centre"
        ? [sides.left, sides.right, sides.below, sides.above]
        : [sides.below, sides.above, sides.right, sides.left]
    let best: { spot: Spot; cost: number } | null = null
    for (const [rank, side] of order.entries()) {
      for (const candidate of side) {
        const spot = {
          left: within(candidate.left, GAP, frame.width - width - GAP),
          top: candidate.top,
        }
        const box = boxAt(spot, width, height)
        const outside =
          box.top < GAP || box.bottom > frame.height - GAP ? 1e9 : 0
        const slide =
          side === sides.right || side === sides.left
            ? Math.abs(spot.top - candidate.from)
            : Math.abs(spot.left - candidate.from)
        const cost = outside + covered(box, taken) * 1000 + rank * 12 + slide
        if (!best || cost < best.cost) best = { spot, cost }
      }
    }
    if (!best) continue
    spots[name.key] = best.spot
    total += best.cost
    if (best.cost >= 1000) covering.push(name.key)
    taken.push(boxAt(best.spot, width, height))
  }
  return { spots, covering, cost: total }
}
