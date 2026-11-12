import { describe, expect, it } from "vitest"

import { placeMarks, placeNames, type Box } from "@/features/weather/mapNames"

const FRAME = { width: 300, height: 280 }

function boxOf(
  spot: { left: number; top: number },
  width: number,
  height: number,
) {
  return {
    left: spot.left,
    top: spot.top,
    right: spot.left + width,
    bottom: spot.top + height,
  }
}

function overlaps(a: Box, b: Box) {
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  )
}

describe("placeNames", () => {
  it("puts a point's name under its marker when there is room", () => {
    const marks = new Map([
      ["a", { left: 100, top: 100, right: 150, bottom: 125 }],
    ])
    const spots = placeNames(FRAME, marks, [
      { key: "a", width: 60, height: 16 },
    ])
    expect(spots.a).toEqual({ left: 95, top: 128 })
  })

  it("moves a name that would cover a neighbour's marker", () => {
    const marks = new Map([
      ["a", { left: 100, top: 100, right: 150, bottom: 125 }],
      ["b", { left: 110, top: 128, right: 160, bottom: 153 }],
    ])
    const names = [
      { key: "a", width: 60, height: 16 },
      { key: "b", width: 60, height: 16 },
    ]
    const spots = placeNames(FRAME, marks, names)
    const placed = names.map((name) =>
      boxOf(spots[name.key]!, name.width, name.height),
    )
    for (const box of placed) {
      for (const mark of marks.values()) expect(overlaps(box, mark)).toBe(false)
    }
    expect(overlaps(placed[0]!, placed[1]!)).toBe(false)
  })

  it("keeps names inside the map at its edges", () => {
    const marks = new Map([
      ["edge", { left: 260, top: 250, right: 300, bottom: 275 }],
    ])
    const spots = placeNames(FRAME, marks, [
      { key: "edge", width: 90, height: 16 },
    ])
    const box = boxOf(spots.edge!, 90, 16)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(FRAME.width)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.bottom).toBeLessThanOrEqual(FRAME.height)
  })

  it("places a crowded corner by trying the name that collided first", () => {
    // The Cabinati map on a 320 px phone: Caprera sud's name, placed first
    // under its marker, used to leave Liscia di Vacca's nowhere to go.
    const frame = { width: 260, height: 234 }
    const marks = new Map<string, Box>([
      ["centre", { left: 139, top: 124, right: 149, bottom: 134 }],
      ["spargi", { left: 15, top: 44, right: 71, bottom: 73 }],
      ["maddalena", { left: 99, top: 12, right: 154, bottom: 41 }],
      ["caprera-est", { left: 187, top: 77, right: 242, bottom: 106 }],
      ["caprera-sud", { left: 153, top: 138, right: 208, bottom: 167 }],
      ["liscia", { left: 202, top: 173, right: 257, bottom: 202 }],
      ["cannigione", { left: 133, top: 194, right: 188, bottom: 223 }],
      ["north", { left: 234, top: 5, right: 255, bottom: 33 }],
    ])
    const names = [
      { key: "spargi", width: 47, height: 16 },
      { key: "maddalena", width: 126, height: 16 },
      { key: "caprera-est", width: 77, height: 16 },
      { key: "caprera-sud", width: 80, height: 16 },
      { key: "liscia", width: 94, height: 16 },
      { key: "cannigione", width: 77, height: 16 },
      { key: "centre", width: 33, height: 16 },
    ]
    const spots = placeNames(frame, marks, names)
    const placed = names.map((name) =>
      boxOf(spots[name.key]!, name.width, name.height),
    )
    placed.forEach((box, index) => {
      for (const mark of marks.values()) expect(overlaps(box, mark)).toBe(false)
      placed.slice(index + 1).forEach((other) => {
        expect(overlaps(box, other)).toBe(false)
      })
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(frame.height)
    })
  })

  it("names the centre on its left first", () => {
    const marks = new Map([
      ["centre", { left: 100, top: 100, right: 110, bottom: 110 }],
    ])
    const spots = placeNames(FRAME, marks, [
      { key: "centre", width: 30, height: 16 },
    ])
    expect(spots.centre).toEqual({ left: 67, top: 97 })
  })
})

describe("placeMarks", () => {
  const size = { width: 55, height: 27, arrow: 15 }

  it("puts the arrow on the point when nothing is in the way", () => {
    const spots = placeMarks(FRAME, [{ key: "a", x: 100, y: 100, ...size }], [])
    expect(spots.a).toEqual({ left: 85, top: 86.5 })
  })

  it("slides a marker off its neighbour, keeping its point under it", () => {
    // Two points 25 px apart up and down, as Caprera sud and Liscia di Vacca
    // are on a 320 px phone.
    const marks = [
      { key: "a", x: 163, y: 149, ...size },
      { key: "b", x: 225, y: 174, ...size },
    ]
    const spots = placeMarks({ width: 254, height: 229 }, marks, [])
    const boxes = marks.map((mark) =>
      boxOf(spots[mark.key]!, mark.width, mark.height),
    )
    expect(overlaps(boxes[0]!, boxes[1]!)).toBe(false)
    marks.forEach((mark, index) => {
      const box = boxes[index]!
      expect(mark.x).toBeGreaterThanOrEqual(box.left)
      expect(mark.x).toBeLessThanOrEqual(box.right)
      expect(mark.y).toBeGreaterThanOrEqual(box.top)
      expect(mark.y).toBeLessThanOrEqual(box.bottom)
      expect(box.right).toBeLessThanOrEqual(254)
    })
  })

  it("keeps clear of what is already drawn", () => {
    const north = { left: 80, top: 60, right: 120, bottom: 90 }
    const spots = placeMarks(
      FRAME,
      [{ key: "a", x: 100, y: 100, ...size }],
      [north],
    )
    expect(overlaps(boxOf(spots.a!, 55, 27), north)).toBe(false)
  })
})
