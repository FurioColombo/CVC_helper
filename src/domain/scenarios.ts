import type { CourseStateSnapshot } from "./invariants"

export function buildD2FoundationScenario(): CourseStateSnapshot {
  return {
    students: [{ id: "student-mario-rossi" }, { id: "student-luca-bianchi" }],
    volunteers: [
      { id: "volunteer-adv-anna", name: "Anna Bianchi", role: "ADV" },
    ],
    boats: [{ id: "boat-quest-7", availability: "available" }],
    faults: [
      { id: "fault-quest-7-sheet", boatId: "boat-quest-7", state: "reported" },
    ],
    crews: [
      {
        id: "crew-sat-pm-1",
        sessionId: "sat-pm",
        studentIds: ["student-mario-rossi", "student-luca-bianchi"],
        volunteerIds: [],
        destination: "boat",
        boatId: "boat-quest-7",
      },
    ],
    landAssignments: [],
    evaluations: [
      {
        id: "evaluation-mario-sat-pm",
        sessionId: "sat-pm",
        studentId: "student-mario-rossi",
        value: "+",
      },
    ],
  }
}
