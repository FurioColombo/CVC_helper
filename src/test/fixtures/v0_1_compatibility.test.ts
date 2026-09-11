import { describe, expect, it } from "vitest"

import { verifyV010Compatibility } from "./v0_1_compatibility"

describe("0.1.0 data compatibility fixture", () => {
  it("round-trips every baseline table without loss and passes invariants", () => {
    const result = verifyV010Compatibility()

    expect(result.status).toBe("PASS")
    expect(result.appVersion).toBe("0.1.0")
    expect(result.checks).toContain(
      "baseline ADV/IS volunteer rows remain byte-equivalent under the CT enum extension",
    )
    expect(result.checks).toContain(
      "baseline duty settings omit the additive explicit extra-day column",
    )
    expect(result.checks).toHaveLength(7)
    expect(result.tableCounts).toMatchObject({
      courses: 1,
      students: 3,
      volunteers: 2,
      boats: 2,
      faults: 1,
      dutyAssignments: 2,
      dutySettings: 1,
      crews: 2,
      crewMembers: 3,
      landAssignments: 1,
      sessionBoats: 1,
      evaluations: 2,
      meta: 1,
    })
  })
})
