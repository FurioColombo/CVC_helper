import {
  COURSE_CONFIG,
  DUTY_DAYS,
  DUTY_SETTING_LISTS,
  DUTY_TIE_BREAKERS,
  type CourseFamily,
  type CourseLevel,
} from "@/domain/config"
import { buildCourseDetails } from "@/domain/course"
import {
  blockingIssues,
  validateCourseState,
  type CourseStateSnapshot,
} from "@/domain/invariants"
import {
  compareVersions,
  dataAccess,
  encodeVersion,
  type DataVersion,
  type Version,
} from "@/domain/compatibility"
import { normalizeCrewCapacity } from "@/domain/crews"
import { APP_VERSION } from "@/appVersion"
import {
  dutySettingItems,
  dutySettingListsFrom,
  type DutySettingItem,
  type DutySettingLists,
} from "@/persistence/dutyItems"
import { validateStoredRows } from "@/persistence/rowIntegrity"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"

type CourseTableName = (typeof COURSE_TABLES)[number]
export type CourseArchiveRow = Record<string, string | number | null> & {
  id: string
}

/** Every table the current app may place in a course archive. */
export type CourseArchiveTables = {
  [Table in CourseTableName]: CourseArchiveRow[]
}

export interface CourseArchive {
  format: "cvc-helper-course"
  formatVersion: 1
  dataVersion: DataVersion
  tables: CourseArchiveTables
}

export type CourseArchiveErrorCode =
  | "invalid-format"
  | "unsupported-format"
  | "incompatible-version"
  | "invalid-data"

const ERROR_MESSAGES: Record<CourseArchiveErrorCode, string> = {
  "invalid-format": "Il file non è un archivio valido di CVC Helper.",
  "unsupported-format":
    "Questo file usa un formato o uno schema non supportato.",
  "incompatible-version": "Aggiorna l’app per importare questo file.",
  "invalid-data": "Il file contiene dati del corso non validi.",
}

/** A safe, user-facing failure that never includes a row value. */
export class CourseArchiveError extends Error {
  constructor(public readonly code: CourseArchiveErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = "CourseArchiveError"
  }
}

const FORMAT = "cvc-helper-course" as const
const FORMAT_VERSION = 1 as const
const DUTY_DAY_IDS = new Set<string>(DUTY_DAYS.map(({ id }) => id))
const DUTY_SETTING_KINDS = new Set<string>(
  DUTY_SETTING_LISTS.map(({ kind }) => kind),
)

// PowerSync columns are nullable at the SQL layer. These are the fields whose
// stored application contract also permits null; all other schema columns are
// required values in an exported row.
const NULLABLE_COLUMNS: Partial<Record<CourseTableName, ReadonlySet<string>>> =
  {
    students: new Set([
      "nickname",
      "dateOfBirth",
      "declaredAgeAtCourseStart",
      "sex",
      "phone",
      "size",
      "initialNote",
      "courseNote",
    ]),
    dutySettings: new Set(["extraDayIds"]),
    crews: new Set(["capacity", "boatId", "position"]),
    crewMembers: new Set(["position"]),
    sessionBoats: new Set(["position"]),
    evaluations: new Set(["value", "note"]),
  }

interface RuntimeSchemaColumn {
  name: string
  type: string
}

interface RuntimeSchemaTable {
  name: string
  columns: RuntimeSchemaColumn[]
}

const schemaTables = (
  AppSchema as unknown as { toJSON: () => { tables: RuntimeSchemaTable[] } }
).toJSON().tables
const columnsByTable = new Map(
  schemaTables.map(({ name, columns }) => [
    name,
    new Map(columns.map(({ name: columnName, type }) => [columnName, type])),
  ]),
)

function fail(code: CourseArchiveErrorCode): never {
  throw new CourseArchiveError(code)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  unknownKeyCode: CourseArchiveErrorCode = "invalid-data",
) {
  const allowed = new Set(requiredKeys)
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
    fail(unknownKeyCode)
  }
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) {
    fail("invalid-data")
  }
}

function isSafeBoundString(value: string) {
  // The production UTF-8 read bridge strips a leading BOM. SQLite text
  // binding also truncates NUL and replaces lone surrogates. Keep embedded
  // BOMs and all other text exactly as supplied.
  return (
    !value.startsWith("\uFEFF") &&
    !value.includes("\0") &&
    !/[\uD800-\uDFFF]/u.test(value)
  )
}

function parseVersion(value: unknown): Version {
  if (!isRecord(value)) fail("invalid-data")
  hasExactKeys(value, ["major", "minor", "patch"])
  const version = {
    major: value.major,
    minor: value.minor,
    patch: value.patch,
  }
  if (
    typeof version.major !== "number" ||
    typeof version.minor !== "number" ||
    typeof version.patch !== "number"
  ) {
    fail("invalid-data")
  }
  try {
    encodeVersion(version as Version)
  } catch {
    fail("invalid-data")
  }
  return version as Version
}

function parseDataVersion(value: unknown): DataVersion {
  if (!isRecord(value)) fail("invalid-data")
  hasExactKeys(value, ["version", "minimumWriter"])
  const version = parseVersion(value.version)
  const minimumWriter = parseVersion(value.minimumWriter)
  if (compareVersions(minimumWriter, version) > 0) fail("invalid-data")
  return { version, minimumWriter }
}

function checkCompatibility(app: Version, dataVersion: DataVersion) {
  const validApp = parseVersion(app)
  if (dataAccess(validApp, dataVersion) === "read-only") {
    fail("incompatible-version")
  }
}

function schemaColumns(table: CourseTableName) {
  const columns = columnsByTable.get(table)
  if (!columns) throw new Error("Missing course table schema")
  return columns
}

function validateRowsShape(value: unknown): CourseArchiveTables {
  if (!isRecord(value)) fail("invalid-data")
  const tableNames = [...COURSE_TABLES]
  hasExactKeys(value, tableNames, "unsupported-format")

  const result = {} as CourseArchiveTables
  for (const table of COURSE_TABLES) {
    const rows = value[table]
    if (!Array.isArray(rows)) fail("invalid-data")
    const columns = schemaColumns(table)
    const rowKeys = ["id", ...columns.keys()]
    const nullable = NULLABLE_COLUMNS[table] ?? new Set<string>()
    const copiedRows: CourseArchiveRow[] = []

    for (const item of rows) {
      if (!isRecord(item)) fail("invalid-data")
      hasExactKeys(item, rowKeys, "unsupported-format")
      if (
        typeof item.id !== "string" ||
        item.id.trim().length === 0 ||
        !isSafeBoundString(item.id)
      ) {
        fail("invalid-data")
      }

      for (const [column, sqlType] of columns) {
        const cell = item[column]
        if (cell === null) {
          if (!nullable.has(column)) fail("invalid-data")
          continue
        }
        if (sqlType === "TEXT") {
          if (typeof cell !== "string" || !isSafeBoundString(cell)) {
            fail("invalid-data")
          }
        } else if (sqlType === "INTEGER") {
          if (typeof cell !== "number" || !Number.isSafeInteger(cell)) {
            fail("invalid-data")
          }
        } else {
          // An archive cannot be validated against a storage type this codec
          // does not understand.
          fail("unsupported-format")
        }
      }
      copiedRows.push({ ...item } as CourseArchiveRow)
    }

    result[table] = copiedRows
  }
  return result
}

function validateUniqueIds(tables: CourseArchiveTables) {
  for (const table of COURSE_TABLES) {
    const ids = new Set<string>()
    for (const row of tables[table]) {
      if (ids.has(row.id)) fail("invalid-data")
      ids.add(row.id)
    }
  }
}

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  )
}

function validateRealUtcTimestamps(tables: CourseArchiveTables) {
  for (const table of COURSE_TABLES) {
    for (const row of tables[table]) {
      for (const key of ["createdAt", "updatedAt"] as const) {
        const value = row[key]
        if (
          typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
        ) {
          fail("invalid-data")
        }
        const parsed = Date.parse(value)
        if (
          !Number.isFinite(parsed) ||
          new Date(parsed).toISOString() !== value
        ) {
          fail("invalid-data")
        }
      }
    }
  }
}

function validateCourseDetails(tables: CourseArchiveTables) {
  const courses = tables.courses
  if (courses.length !== 1) fail("invalid-data")
  const course = courses[0]!
  if (course.active !== 1) fail("invalid-data")

  const family = course.family as CourseFamily
  const level = course.level as CourseLevel
  const startDate = course.startDate as string
  if (
    !Object.values(COURSE_CONFIG).some(
      (configured) =>
        configured.family === family && configured.level === level,
    ) ||
    !validDateOnly(startDate)
  ) {
    fail("invalid-data")
  }

  const expected = buildCourseDetails(
    family,
    level,
    new Date(`${startDate}T12:00:00`),
  )
  if (
    course.isoWeek !== expected.isoWeek ||
    course.year !== expected.year ||
    course.startDate !== expected.startDate ||
    course.endDate !== expected.endDate ||
    course.label !== expected.label
  ) {
    fail("invalid-data")
  }
}

function validatePersistedCrewBoatReferences(tables: CourseArchiveTables) {
  // readCrewPlan requires unassigned crews to store SQL NULL here. The domain
  // invariant uses truthiness and would otherwise accept an empty string.
  if (
    tables.crews.some(
      ({ destination, boatId }) => destination !== "boat" && boatId !== null,
    )
  ) {
    fail("invalid-data")
  }
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string") fail("invalid-data")
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    fail("invalid-data")
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    fail("invalid-data")
  }
  const strings = parsed as string[]
  if (new Set(strings).size !== strings.length) fail("invalid-data")
  return strings
}

interface ValidatedDutySettings {
  courseId: string
  lists: DutySettingLists
  completedDayIds: string[]
}

function validateDutySettings(
  tables: CourseArchiveTables,
): ValidatedDutySettings | undefined {
  const settingsRows = tables.dutySettings
  if (settingsRows.length > 1) fail("invalid-data")
  const settings = settingsRows[0]
  if (!settings) {
    if (tables.dutySettingItems.length > 0) fail("invalid-data")
    return undefined
  }
  if (settings.id !== settings.courseId) fail("invalid-data")

  const desiredPerDay = settings.desiredPerDay as number
  const balanceMinors = settings.balanceMinors as number
  const balanceSex = settings.balanceSex as number
  if (
    desiredPerDay < 0 ||
    ![0, 1].includes(balanceMinors) ||
    ![0, 1].includes(balanceSex) ||
    !DUTY_TIE_BREAKERS.includes(
      settings.tieBreaker as (typeof DUTY_TIE_BREAKERS)[number],
    )
  ) {
    fail("invalid-data")
  }

  const lists: DutySettingLists = {
    fewerDayIds: parseStringArray(settings.fewerDayIds),
    stayOverStudentIds: parseStringArray(settings.stayOverStudentIds),
    completedDayIds: parseStringArray(settings.completedDayIds),
    acknowledgedWarningKeys: parseStringArray(settings.acknowledgedWarningKeys),
    ...(settings.extraDayIds === null
      ? {}
      : { extraDayIds: parseStringArray(settings.extraDayIds) }),
  }

  for (const { field, days } of DUTY_SETTING_LISTS) {
    const values = lists[field] ?? []
    if (days && values.some((value) => !DUTY_DAY_IDS.has(value))) {
      fail("invalid-data")
    }
  }

  const studentIds = new Set(tables.students.map(({ id }) => id))
  if (
    (lists.stayOverStudentIds ?? []).some(
      (studentId) => !studentIds.has(studentId),
    )
  ) {
    fail("invalid-data")
  }

  return {
    courseId: settings.courseId as string,
    lists,
    completedDayIds: [...(lists.completedDayIds ?? [])],
  }
}

function validateDutySettingItems(
  tables: CourseArchiveTables,
  settings: ValidatedDutySettings | undefined,
) {
  const actual = tables.dutySettingItems as unknown as DutySettingItem[]
  if (actual.some(({ kind }) => !DUTY_SETTING_KINDS.has(kind))) {
    fail("invalid-data")
  }
  const expected = settings
    ? dutySettingItems(settings.courseId, settings.lists)
    : []
  const actualLists = dutySettingListsFrom(actual)

  for (const { field } of DUTY_SETTING_LISTS) {
    if (
      JSON.stringify(actualLists[field]) !==
      JSON.stringify(settings?.lists[field] ?? [])
    ) {
      fail("invalid-data")
    }
  }

  if (actual.length !== expected.length) fail("invalid-data")
  const actualById = new Map(actual.map((item) => [item.id, item]))
  for (const wanted of expected) {
    const stored = actualById.get(wanted.id)
    if (
      !stored ||
      stored.courseId !== wanted.courseId ||
      stored.kind !== wanted.kind ||
      stored.value !== wanted.value ||
      stored.position !== wanted.position
    ) {
      fail("invalid-data")
    }
  }
}

function comparePersistedPosition(
  left: CourseArchiveRow,
  right: CourseArchiveRow,
) {
  const leftPosition = left.position as number | null
  const rightPosition = right.position as number | null
  if (leftPosition === null && rightPosition !== null) return -1
  if (rightPosition === null && leftPosition !== null) return 1
  if (leftPosition !== null && rightPosition !== null) {
    const difference = leftPosition - rightPosition
    if (difference !== 0) return difference
  }
  return left.id.localeCompare(right.id)
}

function validateSequentialPositions(rows: readonly CourseArchiveRow[]) {
  const groups = new Map<string, CourseArchiveRow[]>()
  for (const row of rows) {
    const sessionId = row.sessionId as string
    groups.set(sessionId, [...(groups.get(sessionId) ?? []), row])
  }
  for (const group of groups.values()) {
    group.sort(comparePersistedPosition)
    group.forEach((row, index) => {
      const position = row.position as number | null
      if (position !== null && position !== index) fail("invalid-data")
    })
  }
}

interface PositionedMember {
  row: CourseArchiveRow
  position: number
}

function positionedMembersByCrew(tables: CourseArchiveTables) {
  const grouped = new Map<string, CourseArchiveRow[]>()
  for (const row of tables.crewMembers) {
    const crewId = row.crewId as string
    grouped.set(crewId, [...(grouped.get(crewId) ?? []), row])
  }

  const positioned = new Map<string, PositionedMember[]>()
  for (const [crewId, rows] of grouped) {
    rows.sort(comparePersistedPosition)
    const occupied = new Set<number>()
    let nextPosition = 0
    const members = rows.map((row) => {
      const savedPosition = row.position as number | null
      const position = savedPosition ?? nextPosition
      if (
        !Number.isSafeInteger(position) ||
        position < 0 ||
        occupied.has(position)
      ) {
        fail("invalid-data")
      }
      occupied.add(position)
      nextPosition = Math.max(nextPosition, position + 1)
      return { row, position }
    })
    positioned.set(crewId, members)
  }
  return positioned
}

function courseStateSnapshot(
  tables: CourseArchiveTables,
  settings: ValidatedDutySettings | undefined,
): CourseStateSnapshot {
  const crewMembers = tables.crewMembers
  if (
    crewMembers.some(
      ({ personType }) =>
        personType !== "student" && personType !== "volunteer",
    )
  ) {
    fail("invalid-data")
  }
  validateSequentialPositions(tables.crews)
  validateSequentialPositions(tables.sessionBoats)
  const membersByCrew = positionedMembersByCrew(tables)
  const course = tables.courses[0]!
  const family = course.family as CourseFamily
  const level = course.level as CourseLevel

  return {
    students: tables.students.map((student) => ({
      id: student.id,
      firstName: student.firstName as string,
      surname: student.surname as string,
      dateOfBirth: student.dateOfBirth as string | null,
      declaredAgeAtCourseStart: student.declaredAgeAtCourseStart as
        number | null,
      active: student.active as number,
      sex: student.sex as string | null,
      size: student.size as string | null,
    })),
    volunteers: tables.volunteers.map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.name as string,
      role: volunteer.role as string,
    })),
    boats: tables.boats.map((boat) => ({
      id: boat.id,
      type: boat.type as string,
      number: boat.number as string,
      availability: boat.availability as string,
    })),
    faults: tables.faults.map((fault) => ({
      id: fault.id,
      boatId: fault.boatId as string,
      description: fault.description as string,
      state: fault.state as string,
      createdAt: fault.createdAt as string,
      updatedAt: fault.updatedAt as string,
    })),
    dutyAssignments: tables.dutyAssignments.map((assignment) => ({
      dayId: assignment.dayId as string,
      studentId: assignment.studentId as string,
    })),
    completedDutyDayIds: [...(settings?.completedDayIds ?? [])],
    crews: tables.crews.map((crew) => {
      const members = membersByCrew.get(crew.id) ?? []
      const students = members.filter(({ row }) => row.personType === "student")
      const volunteers = members.filter(
        ({ row }) => row.personType === "volunteer",
      )
      const boatId = crew.boatId as string | null
      const capacity = normalizeCrewCapacity(
        crew.capacity as number | null,
        members.length,
        family,
        level,
      )
      return {
        id: crew.id,
        sessionId: crew.sessionId as string,
        studentIds: students.map(({ row }) => row.personId as string),
        volunteerIds: volunteers.map(({ row }) => row.personId as string),
        studentPositions: students.map(({ position }) => position),
        volunteerPositions: volunteers.map(({ position }) => position),
        destination: crew.destination as string,
        ...(boatId === null ? {} : { boatId }),
        capacity,
      }
    }),
    landAssignments: tables.landAssignments.map((assignment) => ({
      id: assignment.id,
      sessionId: assignment.sessionId as string,
      studentId: assignment.studentId as string,
    })),
    sessionBoats: tables.sessionBoats.map((selection) => ({
      id: selection.id,
      sessionId: selection.sessionId as string,
      boatId: selection.boatId as string,
    })),
    evaluations: tables.evaluations.map((evaluation) => ({
      id: evaluation.id,
      sessionId: evaluation.sessionId as string,
      studentId: evaluation.studentId as string,
      value: evaluation.value as string | null,
      note: evaluation.note as string | null,
    })),
    course: {
      family,
      level,
      startDate: course.startDate as string,
    },
  }
}

function validateCourseTables(tables: CourseArchiveTables) {
  validateUniqueIds(tables)
  validateRealUtcTimestamps(tables)

  // This structural validator checks ownership and parent links in addition
  // to the stricter primitive checks above. Keep its diagnostics private:
  // several include IDs from the archive.
  if (validateStoredRows(tables).length > 0) fail("invalid-data")

  validateCourseDetails(tables)
  validatePersistedCrewBoatReferences(tables)
  const settings = validateDutySettings(tables)
  validateDutySettingItems(tables, settings)
  const snapshot = courseStateSnapshot(tables, settings)
  if (blockingIssues(validateCourseState(snapshot)).length > 0) {
    fail("invalid-data")
  }
}

function parseArchiveObject(input: unknown, app: Version): CourseArchive {
  if (!isRecord(input)) fail("invalid-format")
  hasExactKeys(
    input,
    ["format", "formatVersion", "dataVersion", "tables"],
    "unsupported-format",
  )
  if (input.format !== FORMAT || input.formatVersion !== FORMAT_VERSION) {
    fail("unsupported-format")
  }

  const dataVersion = parseDataVersion(input.dataVersion)
  checkCompatibility(app, dataVersion)
  const tables = validateRowsShape(input.tables)
  validateCourseTables(tables)
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    dataVersion,
    tables,
  }
}

/** Parse and validate a decoded archive object or its JSON text. */
export function parseCourseArchive(
  input: unknown,
  app: Version = APP_VERSION,
): CourseArchive {
  try {
    const decoded =
      typeof input === "string" ? (JSON.parse(input) as unknown) : input
    return parseArchiveObject(decoded, app)
  } catch (error) {
    if (error instanceof CourseArchiveError) throw error
    throw new CourseArchiveError(
      typeof input === "string" ? "invalid-format" : "invalid-data",
    )
  }
}

/** Build a versioned course archive after applying the same import checks. */
export function createCourseArchive(
  tables: CourseArchiveTables,
  dataVersion: DataVersion,
  app: Version = APP_VERSION,
): CourseArchive {
  return parseCourseArchive(
    {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      dataVersion,
      tables,
    },
    app,
  )
}

/** A compact, non-personal summary for the import confirmation screen. */
export function archiveSummary(archive: CourseArchive) {
  return {
    label: archive.tables.courses[0]!.label as string,
    students: archive.tables.students.length,
    volunteers: archive.tables.volunteers.length,
    boats: archive.tables.boats.length,
  }
}
