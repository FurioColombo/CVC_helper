import { describe, expect, it } from "vitest"

import {
  crewMemberId,
  dutyAssignmentId,
  evaluationId,
  landAssignmentId,
  sessionBoatId,
} from "@/persistence/placementIds"

describe("placement ids", () => {
  it.each([
    ["land", () => landAssignmentId("sat-pm", "student-1")],
    ["member", () => crewMemberId("crew-1", "student", "student-1")],
    ["sessionBoat", () => sessionBoatId("sat-pm", "boat-1")],
    ["duty", () => dutyAssignmentId("saturday", "student-1")],
    ["evaluation", () => evaluationId("student-1", "sat-pm")],
  ])("the %s id is stable and valid text", (_table, make) => {
    expect(make()).toBe(make())
    expect(typeof make()).toBe("string")
    expect(make().trim()).not.toBe("")
  })

  it("is distinct for every key within a table", () => {
    const ids = [
      landAssignmentId("sat-pm", "student-1"),
      landAssignmentId("sat-pm", "student-2"),
      landAssignmentId("sun-am", "student-1"),
      crewMemberId("crew-1", "student", "student-1"),
      crewMemberId("crew-2", "student", "student-1"),
      crewMemberId("crew-1", "volunteer", "student-1"),
      crewMemberId("crew-1", "student", "student-2"),
      sessionBoatId("sat-pm", "boat-1"),
      sessionBoatId("sat-pm", "boat-2"),
      sessionBoatId("sun-am", "boat-1"),
      dutyAssignmentId("saturday", "student-1"),
      dutyAssignmentId("sunday", "student-1"),
      dutyAssignmentId("saturday", "student-2"),
      evaluationId("student-1", "sat-pm"),
      evaluationId("student-1", "sun-am"),
      evaluationId("student-2", "sat-pm"),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("is distinct across tables for the same words", () => {
    const ids = [
      landAssignmentId("a", "b"),
      sessionBoatId("a", "b"),
      dutyAssignmentId("a", "b"),
      evaluationId("a", "b"),
      crewMemberId("a", "b", "c"),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("does not confuse keys whose parts contain the separator", () => {
    expect(landAssignmentId("a:b", "c")).not.toBe(landAssignmentId("a", "b:c"))
    expect(crewMemberId('a","b', "student", "c")).not.toBe(
      crewMemberId("a", "student", 'b","c'),
    )
  })
})
