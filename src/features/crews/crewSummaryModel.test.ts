import { describe, expect, it } from "vitest"

import {
  buildCrewSummarySections,
  crewLineClassColor,
  groupOccupiedCrewLines,
  type CrewSummaryCrewLine,
  type CrewSummaryMember,
} from "./crewSummaryModel"

const member = (
  label: string,
  overrides: Partial<CrewSummaryMember> = {},
): CrewSummaryMember => ({ label, isMinor: false, duty: null, ...overrides })

const line = (
  overrides: Partial<CrewSummaryCrewLine> &
    Pick<CrewSummaryCrewLine, "crewId" | "crewNumber">,
): CrewSummaryCrewLine => ({
  destination: "unassigned",
  boat: null,
  members: [member(overrides.crewId)],
  warning: null,
  ...overrides,
})

describe("groupOccupiedCrewLines", () => {
  it("orders boat groups in canonical BOAT_TYPES order regardless of input order", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-500",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS 500", number: "5" },
      }),
      line({
        crewId: "c-vago",
        crewNumber: 2,
        destination: "boat",
        boat: { type: "Laser Vago", number: "3" },
      }),
      line({
        crewId: "c-toura",
        crewNumber: 3,
        destination: "boat",
        boat: { type: "RS Toura", number: "1" },
      }),
      line({
        crewId: "c-quest",
        crewNumber: 4,
        destination: "boat",
        boat: { type: "RS Quest", number: "9" },
      }),
    ]

    const groups = groupOccupiedCrewLines(lines)

    expect(groups.map((group) => group.kind)).toEqual([
      "boat",
      "boat",
      "boat",
      "boat",
    ])
    expect(
      groups.map((group) =>
        group.kind === "boat" ? group.boatType : group.kind,
      ),
    ).toEqual(["RS Toura", "RS Quest", "Laser Vago", "RS 500"])
  })

  it("puts a crew with people but no chosen boat in its own unassigned group, and Mezzi always last", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({ crewId: "c-mezzi", crewNumber: 1, destination: "mezzi" }),
      line({
        crewId: "c-boat",
        crewNumber: 2,
        destination: "boat",
        boat: { type: "RS Toura", number: "1" },
      }),
      line({ crewId: "c-none", crewNumber: 3, destination: "unassigned" }),
      line({
        crewId: "c-model-only",
        crewNumber: 4,
        destination: "boat",
        boat: null,
      }),
    ]

    const groups = groupOccupiedCrewLines(lines)

    expect(groups.map((group) => group.kind)).toEqual([
      "boat",
      "unassigned",
      "mezzi",
    ])
    const unassigned = groups.find((group) => group.kind === "unassigned")
    expect(unassigned?.lines.map((crewLine) => crewLine.crewId)).toEqual([
      "c-none",
      "c-model-only",
    ])
  })

  it("excludes empty crews (no members) from every group", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-empty-boat",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS Toura", number: "1" },
        members: [],
      }),
      line({
        crewId: "c-empty-mezzi",
        crewNumber: 2,
        destination: "mezzi",
        members: [],
      }),
      line({ crewId: "c-empty-none", crewNumber: 3, members: [] }),
    ]

    expect(groupOccupiedCrewLines(lines)).toEqual([])
  })

  it("omits a boat-model group entirely when it has no occupied crews", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-quest",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS Quest", number: "2" },
      }),
    ]

    const groups = groupOccupiedCrewLines(lines)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ kind: "boat", boatType: "RS Quest" })
  })

  it("keeps each crew's warning on its line through grouping", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-warned",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS Toura", number: "1" },
        warning: { severity: "yellow", count: 1 },
      }),
    ]

    const [group] = groupOccupiedCrewLines(lines)
    expect(group?.lines[0]?.warning).toEqual({ severity: "yellow", count: 1 })
  })
})

describe("crewLineClassColor", () => {
  it("uses the Mezzi colour for a Mezzi line regardless of any boat field", () => {
    expect(
      crewLineClassColor(
        line({ crewId: "c", crewNumber: 1, destination: "mezzi" }),
      ),
    ).toBe("#0b526b")
  })

  it("uses the boat's own class colour when a boat is assigned", () => {
    expect(
      crewLineClassColor(
        line({
          crewId: "c",
          crewNumber: 1,
          destination: "boat",
          boat: { type: "RS Quest", number: "2" },
        }),
      ),
    ).toBe("#2f9e46")
  })

  it("falls back to a neutral grey when no boat is chosen yet", () => {
    expect(
      crewLineClassColor(
        line({ crewId: "c", crewNumber: 1, destination: "unassigned" }),
      ),
    ).toBe("#6b8790")
  })
})

describe("buildCrewSummarySections", () => {
  it("assembles title, grouped occupied crews, and the three flat sections unchanged", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-toura",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS Toura", number: "1" },
      }),
      line({ crewId: "c-mezzi", crewNumber: 2, destination: "mezzi" }),
    ]
    const availableMembers = [member("Elena")]
    const landMembers = [member("Carlo")]
    const emptyLabels = ["RS Quest 7"]

    const sections = buildCrewSummarySections({
      title: "Sabato PM",
      lines,
      availableMembers,
      landMembers,
      emptyLabels,
    })

    expect(sections.title).toBe("Sabato PM")
    expect(sections.groups.map((group) => group.kind)).toEqual([
      "boat",
      "mezzi",
    ])
    expect(sections.availableMembers).toBe(availableMembers)
    expect(sections.landMembers).toBe(landMembers)
    expect(sections.emptyLabels).toBe(emptyLabels)
  })

  it("produces no groups when every line is empty, while keeping the other sections", () => {
    const sections = buildCrewSummarySections({
      title: "Domenica AM",
      lines: [line({ crewId: "c", crewNumber: 1, members: [] })],
      availableMembers: [],
      landMembers: [member("Bea")],
      emptyLabels: [],
    })

    expect(sections.groups).toEqual([])
    expect(sections.landMembers).toEqual([member("Bea")])
  })
})
