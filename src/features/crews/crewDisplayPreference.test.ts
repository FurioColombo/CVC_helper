import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getCrewDisplayColumns,
  setCrewDisplayColumns,
} from "@/features/crews/crewDisplayPreference"

const STORAGE_KEY = "cvc-helper.crew-display-columns"

describe("crew display column preference", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("defaults to two columns when no preference exists", () => {
    expect(getCrewDisplayColumns()).toBe(2)
  })

  it("defaults to two columns when stored data is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, "four")

    expect(getCrewDisplayColumns()).toBe(2)
  })

  it.each([2, 3] as const)("persists %i columns locally", (columns) => {
    setCrewDisplayColumns(columns)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(columns))
    expect(getCrewDisplayColumns()).toBe(columns)
  })

  it("uses the default when local storage cannot be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError")
    })

    expect(getCrewDisplayColumns()).toBe(2)
    expect(() => setCrewDisplayColumns(2)).not.toThrow()
  })
})
