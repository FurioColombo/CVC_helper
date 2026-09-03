import { describe, expect, it } from "vitest"

import { SESSION_SEQUENCE } from "@/domain/config"
import { validateCourseState } from "@/domain/invariants"
import { buildD2FullWeekScenario } from "@/domain/scenarios"

describe("deterministic full-week scenario", () => {
  it("returns a fresh, invariant-safe D2 week with every session represented", () => {
    const first = buildD2FullWeekScenario()
    const second = buildD2FullWeekScenario()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.students).not.toBe(second.students)
    expect(first.students).toHaveLength(21)
    expect(new Set(first.crews.map(({ sessionId }) => sessionId))).toEqual(
      new Set(SESSION_SEQUENCE.map(({ id }) => id)),
    )
    const dutyOverride = first.timeline.find(
      (event) => event.kind === "duty-override",
    )!
    const finalDutyIds = (first.dutyAssignments ?? [])
      .filter(({ dayId }) => dayId === dutyOverride.dayId)
      .map(({ studentId }) => studentId)
    expect(finalDutyIds).toContain(dutyOverride.addedStudentId)
    expect(finalDutyIds).not.toContain(dutyOverride.removedStudentId)
    expect(validateCourseState(first)).toEqual([])
  })
})
