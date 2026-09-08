import { describe, expect, it } from "vitest"

import {
  rotatedImageDimensions,
  updateNormalizedCrop,
  type NormalizedCrop,
} from "@/features/students/studentImageCrop"

const CROP: NormalizedCrop = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }

describe("student scan crop geometry", () => {
  it("computes the full bounds for arbitrary rotations", () => {
    expect(rotatedImageDimensions(1_000, 500, 0)).toEqual({
      width: 1_000,
      height: 500,
    })
    expect(rotatedImageDimensions(1_000, 500, 90)).toEqual({
      width: 500,
      height: 1_000,
    })
    const diagonal = rotatedImageDimensions(1_000, 500, 37)
    expect(diagonal.width).toBe(1_100)
    expect(diagonal.height).toBe(1_002)
  })

  it("moves and resizes the crop without escaping the image", () => {
    expect(updateNormalizedCrop(CROP, "move", 0.5, -0.5)).toEqual({
      x: 0.4,
      y: 0,
      width: 0.6,
      height: 0.6,
    })
    const resized = updateNormalizedCrop(CROP, "north-west", 0.9, 0.9)
    expect(resized.x).toBeCloseTo(0.64)
    expect(resized.y).toBeCloseTo(0.64)
    expect(resized.width).toBeCloseTo(0.16)
    expect(resized.height).toBeCloseTo(0.16)
    expect(updateNormalizedCrop(CROP, "south-east", 0.9, 0.9)).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.8,
      height: 0.8,
    })
  })
})
