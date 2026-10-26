/**
 * Deterministic ids of the placement rows (SC-B1-1, owner decision 12).
 *
 * Two phones that make the same placement offline write the same row, not two:
 * the id is the row's natural key, so after both upload there is one row and
 * the latest edit stands. Each key holds the UUID of a course record (a
 * student, a crew or a boat), which already scopes it to its course. The
 * encoding is a JSON array, as `dutySettingItemId`: no separator can be
 * confused with a character of an id, and the first element names the table,
 * so one key never means two things. Rows written before this keep their ids.
 */
export const landAssignmentId = (sessionId: string, studentId: string) =>
  JSON.stringify(["land", sessionId, studentId])

export const crewMemberId = (
  crewId: string,
  personType: string,
  personId: string,
) => JSON.stringify(["member", crewId, personType, personId])

export const sessionBoatId = (sessionId: string, boatId: string) =>
  JSON.stringify(["sessionBoat", sessionId, boatId])

export const dutyAssignmentId = (dayId: string, studentId: string) =>
  JSON.stringify(["duty", dayId, studentId])

export const evaluationId = (studentId: string, sessionId: string) =>
  JSON.stringify(["evaluation", studentId, sessionId])
