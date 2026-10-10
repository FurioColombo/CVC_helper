import { describe, expect, it } from "vitest"

import { noteInstalledVersion } from "@/navigation/installedVersion"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

describe("noteInstalledVersion", () => {
  it("says nothing on a first start, then names the previous version once after an update", () => {
    const device = storage()
    expect(noteInstalledVersion("0.4.0", device)).toBeNull()
    expect(noteInstalledVersion("0.4.0", device)).toBeNull()
    expect(noteInstalledVersion("0.4.1", device)).toBe("0.4.0")
    expect(noteInstalledVersion("0.4.1", device)).toBeNull()
  })

  it("says nothing when storage is unavailable or refuses", () => {
    expect(noteInstalledVersion("0.4.0", undefined)).toBeNull()
    expect(
      noteInstalledVersion("0.4.0", {
        getItem: () => {
          throw new Error("blocked")
        },
        setItem: () => {},
      }),
    ).toBeNull()
  })
})
