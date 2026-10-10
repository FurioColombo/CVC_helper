import { describe, expect, it } from "vitest"

import { eraseVerticalTableRules } from "./studentScanRules"

const PAPER = [236, 233, 226] as const
const INK = [38, 40, 44] as const

function sheet(width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    pixels.set([...PAPER, 255], i * 4)
  }
  const paint = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y += 1)
      for (let x = x0; x <= x1; x += 1)
        pixels.set([...INK, 255], (y * width + x) * 4)
  }
  const grey = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!
  }
  return { pixels, paint, grey }
}

// A 3 px rule drifting one pixel every 150 rows, like a slightly bent page.
const ruleCentre = (y: number) => 201 + Math.floor((y - 100) / 150)

function ruledSheet() {
  const width = 900
  const height = 800
  const page = sheet(width, height)
  for (let y = 100; y <= 699; y += 1) {
    const centre = ruleCentre(y)
    page.paint(centre - 1, y, centre + 1, y)
  }
  // Horizontal row rules crossing it, which must survive away from the band.
  for (let y = 144; y < 700; y += 44) page.paint(50, y, 850, y + 1)
  // A letter touching the rule's right edge, and one well inside the cell.
  page.paint(ruleCentre(300) + 2, 290, ruleCentre(300) + 14, 309)
  page.paint(400, 290, 412, 309)
  // A thin stroke aligned under the rule's end after a three-row break.
  page.paint(ruleCentre(699) - 1, 703, ruleCentre(699) + 1, 724)
  return { width, height, ...page }
}

// Pixel work on whole synthetic sheets: about 4 s per case alone, 8-9 s when
// the four unit-test workers share the CPU, and once 10.8 s, past the 10 s
// default (H1). Their own limit leaves room for that load; nothing they assert
// depends on time.
describe("eraseVerticalTableRules", { timeout: 30_000 }, () => {
  it("repaints a long, slightly slanted rule with the paper beside it", () => {
    const page = ruledSheet()
    const result = eraseVerticalTableRules(page.pixels, page.width, page.height)

    expect(result.rules).toBe(1)
    const onRowRule = (y: number) => y >= 144 && (y - 144) % 44 < 2
    for (let y = 100; y <= 699; y += 1) {
      // A crossing keeps the row rule's ink: the paper beside it is that rule.
      if (onRowRule(y)) continue
      const centre = ruleCentre(y)
      for (let x = centre - 1; x <= centre + 1; x += 1) {
        expect(page.grey(x, y), `rule pixel ${x},${y}`).toBeGreaterThan(200)
      }
    }
  })

  it("keeps touching letters outside the rule band, row rules and short strokes", () => {
    const page = ruledSheet()
    eraseVerticalTableRules(page.pixels, page.width, page.height)

    const touchingLeft = ruleCentre(300) + 3
    for (let y = 290; y <= 309; y += 1) {
      for (let x = touchingLeft; x <= ruleCentre(300) + 14; x += 1) {
        expect(page.grey(x, y), `touching letter ${x},${y}`).toBeLessThan(60)
      }
      for (let x = 400; x <= 412; x += 1) {
        expect(page.grey(x, y)).toBeLessThan(60)
      }
    }
    for (let y = 144; y < 700; y += 44) {
      expect(page.grey(60, y), `row rule at ${y}`).toBeLessThan(60)
      expect(page.grey(840, y + 1)).toBeLessThan(60)
    }
    for (let y = 703; y <= 724; y += 1) {
      expect(page.grey(ruleCentre(699), y), `stroke ${y}`).toBeLessThan(60)
    }
  })

  it.each([
    ["a 3 px stroke on the right", 2, 4, 22],
    ["a 5 px stroke on the right", 2, 6, 22],
    ["a 3 px stroke on the left", -4, -2, 22],
    // A capital touching the rule on a close capture, as tall as a text line.
    ["a 45-row 3 px stroke on the right", 2, 4, 45],
    ["a 60-row 3 px stroke on the left", -4, -2, 60],
    ["a 90-row 5 px stroke on the right", 2, 6, 90],
  ])(
    "keeps %s touching the rule, beyond the rule's own band",
    (_label, from, to, rows) => {
      const width = 400
      const height = 700
      const page = sheet(width, height)
      // A straight 3 px rule at x 199-201 and a letter stroke fused to it.
      page.paint(199, 50, 201, 649)
      page.paint(200 + from, 300, 200 + to, 299 + rows)

      const result = eraseVerticalTableRules(page.pixels, width, height)

      expect(result.rules).toBe(1)
      // The band is the rule's width plus half a pixel each side, so only
      // the stroke column that touches the rule may be repainted.
      const kept = from > 0 ? [from + 1, to] : [from, to - 1]
      for (let y = 300; y < 300 + rows; y += 1) {
        for (let x = 200 + kept[0]!; x <= 200 + kept[1]!; x += 1) {
          expect(page.grey(x, y), `stroke ${x},${y}`).toBeLessThan(60)
        }
      }
      // The whole rule goes, on both sides of the stroke.
      for (const y of [60, 200, 299, 300 + rows, 500, 640]) {
        for (let x = 199; x <= 201; x += 1) {
          expect(page.grey(x, y), `rule ${x},${y}`).toBeGreaterThan(200)
        }
      }
    },
  )

  it("leaves a page without long rules exactly as it was", () => {
    const width = 600
    const height = 400
    const page = sheet(width, height)
    for (let row = 0; row < 8; row += 1) {
      for (let letter = 0; letter < 20; letter += 1) {
        const x = 40 + letter * 26
        const y = 30 + row * 44
        page.paint(x, y, x + 3, y + 21)
        page.paint(x, y + 18, x + 14, y + 21)
      }
    }
    const before = Uint8ClampedArray.from(page.pixels)

    const result = eraseVerticalTableRules(page.pixels, width, height)

    expect(result).toEqual({ rules: 0, erasedPixels: 0 })
    expect(page.pixels).toEqual(before)
  })

  it("leaves a dark border along the photo's own edge alone", () => {
    const width = 400
    const height = 700
    const page = sheet(width, height)
    // Background showing past the sheet on both sides.
    page.paint(0, 40, 4, 659)
    page.paint(width - 5, 40, width - 1, 659)
    const before = Uint8ClampedArray.from(page.pixels)

    const result = eraseVerticalTableRules(page.pixels, width, height)

    expect(result).toEqual({ rules: 0, erasedPixels: 0 })
    expect(page.pixels).toEqual(before)
  })

  it("ignores a buffer that does not match its dimensions", () => {
    const pixels = new Uint8ClampedArray(16)
    expect(eraseVerticalTableRules(pixels, 10, 10)).toEqual({
      rules: 0,
      erasedPixels: 0,
    })
  })
})
