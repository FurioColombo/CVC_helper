// Builds src/features/weather/coastline.ts from an OpenStreetMap coastline
// extract, so Vento's map draws the islands without any request at run time.
//
// Fetch the extract once (Overpass API), then run:
//   node scripts/build-coastline.mjs <overpass.json>
// Query: [out:json];way["natural"="coastline"](41.08,9.27,41.31,9.58);out geom;
//
// OpenStreetMap coastlines keep the land on the left. Each zone's box clips
// them; a stretch that leaves the box is closed along the box's edge,
// counter-clockwise, to the next stretch that enters it.
import { readFileSync, writeFileSync } from "node:fs"

const [input] = process.argv.slice(2)
if (!input)
  throw new Error("usage: node scripts/build-coastline.mjs <overpass.json>")

/** Each zone's box: the forecast points with room around them. */
const ZONES = {
  derive: { south: 41.166, north: 41.196, west: 9.432, east: 9.474 },
  cabinati: { south: 41.105, north: 41.285, west: 9.295, east: 9.56 },
}
const WIDTH = 400
const TOLERANCE_PX = 0.35

const data = JSON.parse(readFileSync(input, "utf8"))
const ways = data.elements.filter((element) => element.type === "way")

// --- Join ways into chains by their shared end nodes ---
function chainsOf(ways) {
  const byStart = new Map()
  for (const way of ways) byStart.set(way.nodes[0], way)
  const used = new Set()
  const chains = []
  for (const way of ways) {
    if (used.has(way.id)) continue
    // Walk back to the chain's first way, unless it is a ring.
    let first = way
    const seen = new Set([way.id])
    for (;;) {
      const previous = ways.find(
        (other) => !seen.has(other.id) && other.nodes.at(-1) === first.nodes[0],
      )
      if (!previous) break
      seen.add(previous.id)
      first = previous
    }
    const points = []
    let current = first
    while (current && !used.has(current.id)) {
      used.add(current.id)
      const coordinates = current.geometry.map(({ lat, lon }) => [lon, lat])
      points.push(...(points.length ? coordinates.slice(1) : coordinates))
      current = byStart.get(current.nodes.at(-1))
    }
    const closed =
      points.length > 3 &&
      points[0][0] === points.at(-1)[0] &&
      points[0][1] === points.at(-1)[1]
    chains.push({ points, closed })
  }
  return chains
}

const inside = (box, [x, y]) =>
  x >= box.west && x <= box.east && y >= box.south && y <= box.north

/** Liang-Barsky: the part of a segment inside the box, as parameters. */
function clipSegment(box, [x0, y0], [x1, y1]) {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const checks = [
    [-dx, x0 - box.west],
    [dx, box.east - x0],
    [-dy, y0 - box.south],
    [dy, box.north - y0],
  ]
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }
  const at = (t) => [x0 + t * dx, y0 + t * dy]
  return { from: at(t0), to: at(t1), enters: t0 > 0, leaves: t1 < 1 }
}

/** Pieces of a chain inside the box, each from its entry to its exit. */
function clipChain(box, { points, closed }) {
  if (points.every((point) => inside(box, point))) {
    return closed
      ? { rings: [points], pieces: [] }
      : { rings: [], pieces: [{ points, open: true }] }
  }
  const pieces = []
  let current = null
  for (let index = 0; index < points.length - 1; index += 1) {
    const segment = clipSegment(box, points[index], points[index + 1])
    if (!segment) {
      current = null
      continue
    }
    if (!current || segment.enters) {
      current = { points: [segment.from], startsOnEdge: segment.enters }
      pieces.push(current)
    }
    current.points.push(segment.to)
    if (segment.leaves) {
      current.endsOnEdge = true
      current = null
    }
  }
  // A ring that starts inside the box: its last piece runs on into its first.
  if (closed && pieces.length > 1) {
    const first = pieces[0]
    const last = pieces.at(-1)
    if (!first.startsOnEdge && !last.endsOnEdge) {
      last.points.push(...first.points.slice(1))
      last.endsOnEdge = first.endsOnEdge
      pieces.shift()
    }
  }
  for (const piece of pieces) {
    if (!piece.startsOnEdge || !piece.endsOnEdge) piece.open = true
  }
  return { rings: [], pieces }
}

/** Position along the box's edge, counter-clockwise from the south-west corner. */
function edgePosition(box, [x, y]) {
  const w = box.east - box.west
  const h = box.north - box.south
  const near = (a, b) => Math.abs(a - b) < 1e-9
  if (near(y, box.south)) return x - box.west
  if (near(x, box.east)) return w + (y - box.south)
  if (near(y, box.north)) return w + h + (box.east - x)
  return 2 * w + h + (box.north - y)
}

function cornersBetween(box, from, to) {
  const w = box.east - box.west
  const h = box.north - box.south
  const perimeter = 2 * (w + h)
  const corners = [
    [w, [box.east, box.south]],
    [w + h, [box.east, box.north]],
    [2 * w + h, [box.west, box.north]],
    [perimeter, [box.west, box.south]],
  ]
  const span = (to - from + perimeter) % perimeter
  const passed = []
  for (const [position, corner] of [
    ...corners,
    ...corners.map(([p, c]) => [p + perimeter, c]),
  ]) {
    const distance = position - from
    if (distance > 0 && distance < span) passed.push([distance, corner])
  }
  return passed.sort((a, b) => a[0] - b[0]).map(([, corner]) => corner)
}

function stitch(box, pieces) {
  const w = box.east - box.west
  const h = box.north - box.south
  const perimeter = 2 * (w + h)
  const edgePieces = pieces.filter((piece) => !piece.open)
  const rings = []
  const done = new Set()
  for (const start of edgePieces) {
    if (done.has(start)) continue
    const ring = []
    let piece = start
    while (piece && !done.has(piece)) {
      done.add(piece)
      ring.push(...piece.points)
      const exit = edgePosition(box, piece.points.at(-1))
      let next = null
      let best = Infinity
      for (const candidate of edgePieces) {
        const entry = edgePosition(box, candidate.points[0])
        const distance = (entry - exit + perimeter) % perimeter
        if (distance < best) {
          best = distance
          next = candidate
        }
      }
      ring.push(...cornersBetween(box, exit, edgePosition(box, next.points[0])))
      piece = next
    }
    rings.push(ring)
  }
  return rings
}

// --- Projection and simplification ---
function projector(box) {
  const scaleX = Math.cos(((box.south + box.north) / 2) * (Math.PI / 180))
  const k = WIDTH / ((box.east - box.west) * scaleX)
  return {
    height: Math.round((box.north - box.south) * k),
    project: ([x, y]) => [(x - box.west) * scaleX * k, (box.north - y) * k],
  }
}

function simplify(points, tolerance) {
  if (points.length < 3) return points
  const [fx, fy] = points[0]
  const [lx, ly] = points.at(-1)
  // A ring's two ends coincide, and a line through one point measures nothing.
  if (Math.hypot(lx - fx, ly - fy) < 1e-6) {
    const middle = Math.floor(points.length / 2)
    return [
      ...simplify(points.slice(0, middle + 1), tolerance).slice(0, -1),
      ...simplify(points.slice(middle), tolerance),
    ]
  }
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const length = Math.hypot(bx - ax, by - ay) || 1
    let worst = -1
    let at = -1
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i]
      const distance =
        Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
      if (distance > worst) {
        worst = distance
        at = i
      }
    }
    if (worst > tolerance) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }
  return points.filter((_, index) => keep[index])
}

const chains = chainsOf(ways)
const output = {}
for (const [zone, box] of Object.entries(ZONES)) {
  const rings = []
  const pieces = []
  for (const chain of chains) {
    const clipped = clipChain(box, chain)
    rings.push(...clipped.rings)
    pieces.push(...clipped.pieces)
  }
  const dangling = pieces.filter((piece) => piece.open)
  if (dangling.length) {
    throw new Error(
      `${zone}: ${dangling.length} coastline ends inside the box; widen the extract`,
    )
  }
  rings.push(...stitch(box, pieces))
  const { height, project } = projector(box)
  const path = rings
    .map((ring) => simplify(ring.map(project), TOLERANCE_PX))
    .filter((ring) => ring.length >= 3)
    .map(
      (ring) =>
        "M" +
        ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") +
        "Z",
    )
    .join("")
  output[zone] = { box, width: WIDTH, height, path }
  console.log(zone, rings.length, "rings,", path.length, "characters")
}

const source = `// Generated by scripts/build-coastline.mjs from OpenStreetMap; do not edit.
// Coastline data © OpenStreetMap contributors, ODbL 1.0
// (https://www.openstreetmap.org/copyright). Land is the filled path.

export const COASTLINES = ${JSON.stringify(output, null, 2)} as const
`
writeFileSync("src/features/weather/coastline.ts", source)
