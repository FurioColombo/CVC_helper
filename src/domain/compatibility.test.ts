import { describe, expect, it } from "vitest"

import { APP_VERSION } from "@/appVersion"

import {
  compareVersions,
  dataAccess,
  dataVersionAfterSyncSwitch,
  dataVersionAfterWrite,
  decodeVersion,
  encodeVersion,
  formatVersion,
  minimumWriterOf,
  parseVersion,
  type DataVersion,
} from "@/domain/compatibility"

const v = parseVersion
const data = (version: string, minimumWriter: string): DataVersion => ({
  version: v(version),
  minimumWriter: v(minimumWriter),
})

describe("versions", () => {
  it.each(["0.4.0", "0.10.2", "1.0.0", "12.345.678"])(
    "parse, format and encode %s without loss",
    (text) => {
      expect(formatVersion(v(text))).toBe(text)
      expect(decodeVersion(encodeVersion(v(text)))).toEqual(v(text))
    },
  )

  it.each(["0.4", "v0.4.0", "0.4.0-beta", "0.4.0 ", ""])(
    "refuse %j",
    (text) => {
      expect(() => parseVersion(text)).toThrow("Not a version")
    },
  )

  it("encode in the order versions compare, minor 10 after minor 9", () => {
    const ordered = ["0.3.9", "0.4.0", "0.9.12", "0.10.0", "1.0.0", "1.0.1"]
    for (const [earlier, later] of ordered
      .slice(1)
      .map((text, index) => [ordered[index]!, text])) {
      expect(compareVersions(v(earlier!), v(later!))).toBeLessThan(0)
      expect(encodeVersion(v(earlier!))).toBeLessThan(encodeVersion(v(later!)))
    }
  })

  it("refuse a part that does not fit the integer encoding", () => {
    expect(() => encodeVersion({ major: 0, minor: 1000, patch: 0 })).toThrow()
    expect(() => decodeVersion(-1)).toThrow()
    expect(() => decodeVersion(1.5)).toThrow()
  })
})

describe("the minimum writer of an app's data", () => {
  it.each([
    ["0.4.0", "0.3.0"],
    ["0.4.3", "0.3.0"],
    ["0.5.0", "0.4.0"],
    ["1.2.0", "1.1.0"],
  ])("for %s is %s, the previous minor version", (app, minimum) => {
    expect(minimumWriterOf(v(app))).toEqual(v(minimum))
  })

  it("must be declared by a major release", () => {
    expect(() => minimumWriterOf(v("1.0.0"))).toThrow("declare")
  })

  // D3 review DI-Q3: a version whose minimum writer cannot be computed (a
  // major release) cannot open any database, so the bump that makes one must
  // first declare it.
  it("can be computed for this build's own version", () => {
    expect(() => minimumWriterOf(APP_VERSION)).not.toThrow()
  })
})

// 03 §3.1: an app reads and writes data of its own and the previous minor
// version; one older than the data's minimum writer opens read-only.
describe("dataAccess", () => {
  it.each([
    // app, data's newest writer, its minimum writer, access
    ["0.4.0", null, null, "write"], // written by 0.1 to 0.3: no record
    ["0.4.0", "0.4.0", "0.3.0", "write"],
    ["0.4.0", "0.4.2", "0.3.0", "write"], // a later patch
    ["0.4.2", "0.4.0", "0.3.0", "write"],
    ["0.4.0", "0.5.0", "0.4.0", "write"], // the previous minor version
    ["0.4.0", "0.6.0", "0.5.0", "read-only"], // two minor versions behind
    ["0.4.9", "0.6.0", "0.5.0", "read-only"],
    ["0.5.0", "0.6.0", "0.5.0", "write"],
    ["0.7.3", "1.0.0", "0.7.0", "write"], // a major release's declaration
    ["0.6.0", "1.0.0", "0.7.0", "read-only"],
    ["0.9.0", "0.4.0", "0.3.0", "write"], // newer than the data: it upgrades
  ] as const)(
    "app %s on data written by %s (minimum %s): %s",
    (app, version, minimum, access) => {
      const stored = version && minimum ? data(version, minimum) : null
      expect(dataAccess(v(app), stored)).toBe(access)
    },
  )
})

describe("dataVersionAfterWrite", () => {
  it.each([
    // app, stored newest, stored minimum, recorded newest, recorded minimum
    ["0.4.0", null, null, "0.4.0", "0.3.0"],
    ["0.4.1", "0.4.0", "0.3.0", "0.4.1", "0.3.0"],
    ["0.5.0", "0.4.1", "0.3.0", "0.5.0", "0.4.0"],
    // The previous minor version writes newer data: nothing goes back.
    ["0.4.0", "0.5.0", "0.4.0", "0.5.0", "0.4.0"],
    ["0.5.2", "0.6.0", "0.5.0", "0.6.0", "0.5.0"],
  ] as const)(
    "%s writing data of %s (minimum %s) records %s and %s",
    (app, version, minimum, recorded, recordedMinimum) => {
      const stored = version && minimum ? data(version, minimum) : null
      expect(dataVersionAfterWrite(v(app), stored)).toEqual(
        data(recorded, recordedMinimum),
      )
    },
  )

  it("never lets an app write data it was excluded from, after any writer", () => {
    const apps = ["0.4.0", "0.4.5", "0.5.0", "0.5.3", "0.6.0", "0.7.1"]
    for (const first of apps) {
      for (const second of apps) {
        const stored = dataVersionAfterWrite(v(first), null)
        if (dataAccess(v(second), stored) === "read-only") continue
        const after = dataVersionAfterWrite(v(second), stored)
        for (const third of apps) {
          if (dataAccess(v(third), stored) === "read-only") {
            expect(dataAccess(v(third), after)).toBe("read-only")
          }
        }
      }
    }
  })
})

describe("dataVersionAfterSyncSwitch", () => {
  it.each([
    // app, stored newest, stored minimum, recorded newest, recorded minimum
    ["0.5.0", null, null, "0.5.0", "0.5.0"],
    ["0.5.0", "0.4.0", "0.3.0", "0.5.0", "0.5.0"],
    ["0.5.3", "0.5.1", "0.4.0", "0.5.3", "0.5.0"],
    // A later version switching keeps its own, higher minimum.
    ["0.7.0", "0.6.0", "0.5.0", "0.7.0", "0.6.0"],
    // A newer writer's record is never lowered.
    ["0.5.0", "0.6.2", "0.5.0", "0.6.2", "0.5.0"],
  ] as const)(
    "%s switching data of %s (minimum %s) records %s and %s",
    (app, version, minimum, recorded, recordedMinimum) => {
      const stored = version && minimum ? data(version, minimum) : null
      expect(dataVersionAfterSyncSwitch(v(app), stored)).toEqual(
        data(recorded, recordedMinimum),
      )
    },
  )

  it("leaves every app before synced tables read-only", () => {
    for (const app of ["0.5.0", "0.6.1"]) {
      for (const stored of [null, data("0.4.0", "0.3.0")]) {
        const after = dataVersionAfterSyncSwitch(v(app), stored)
        for (const older of ["0.1.0", "0.3.0", "0.4.0", "0.4.9"]) {
          expect(dataAccess(v(older), after)).toBe("read-only")
        }
      }
    }
  })

  it("is refused to an app that predates synced tables", () => {
    expect(() => dataVersionAfterSyncSwitch(v("0.4.9"), null)).toThrow(
      "0.4.9 predates synced tables (0.5.0)",
    )
  })
})
