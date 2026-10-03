import { describe, expect, it } from "vitest"

import {
  allStudentsAssigned,
  buildCrewSummarySections,
  crewCardLabel,
  crewLineClassColor,
  groupNumberWidthCh,
  groupOccupiedCrewLines,
  modelOnlyName,
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

  it("lists a boat-less occupied crew under the session's one model, in crew order with that model's boat crews", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({
        crewId: "c-quest-2",
        crewNumber: 1,
        destination: "boat",
        boat: { type: "RS Quest", number: "2" },
        inferredBoatType: "RS Quest",
      }),
      line({
        crewId: "c-model-only",
        crewNumber: 2,
        destination: "unassigned",
        inferredBoatType: "RS Quest",
      }),
      line({
        crewId: "c-quest-7",
        crewNumber: 3,
        destination: "boat",
        boat: { type: "RS Quest", number: "7" },
        inferredBoatType: "RS Quest",
      }),
      line({
        crewId: "c-mezzi",
        crewNumber: 4,
        destination: "mezzi",
        inferredBoatType: "RS Quest",
      }),
    ]

    const groups = groupOccupiedCrewLines(lines)

    expect(groups.map((group) => group.kind)).toEqual(["boat", "mezzi"])
    expect(groups[0]).toMatchObject({ kind: "boat", boatType: "RS Quest" })
    expect(groups[0]?.lines.map((crewLine) => crewLine.crewId)).toEqual([
      "c-quest-2",
      "c-model-only",
      "c-quest-7",
    ])
    // Mezzi never takes the session's model, even with one inferred.
    expect(groups[1]?.lines.map((crewLine) => crewLine.crewId)).toEqual([
      "c-mezzi",
    ])
  })

  it("never drops a crew whose boat model is outside BOAT_TYPES: a trailing group per model, before the unassigned and Mezzi groups", () => {
    const lines: CrewSummaryCrewLine[] = [
      line({ crewId: "c-mezzi", crewNumber: 1, destination: "mezzi" }),
      line({
        crewId: "c-hobie-1",
        crewNumber: 2,
        destination: "boat",
        boat: { type: "Hobie 16", number: "1" },
      }),
      line({ crewId: "c-none", crewNumber: 3 }),
      line({
        crewId: "c-toura",
        crewNumber: 4,
        destination: "boat",
        boat: { type: "RS Toura", number: "4" },
      }),
      line({
        crewId: "c-snipe",
        crewNumber: 5,
        destination: "boat",
        boat: { type: "Snipe", number: "9" },
      }),
      line({
        crewId: "c-hobie-2",
        crewNumber: 6,
        destination: "boat",
        boat: { type: "Hobie 16", number: "2" },
      }),
    ]

    const groups = groupOccupiedCrewLines(lines)

    expect(
      groups.map((group) =>
        group.kind === "boat"
          ? group.boatType
          : group.kind === "other-model"
            ? group.modelName
            : group.kind,
      ),
    ).toEqual(["RS Toura", "Hobie 16", "Snipe", "unassigned", "mezzi"])
    // Every occupied crew appears exactly once.
    expect(
      groups
        .flatMap((group) => group.lines.map((crewLine) => crewLine.crewId))
        .sort(),
    ).toEqual(lines.map((crewLine) => crewLine.crewId).sort())
    expect(groups[1]?.lines.map((crewLine) => crewLine.crewId)).toEqual([
      "c-hobie-1",
      "c-hobie-2",
    ])
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

  it("takes the session's inferred model colour for a boat-less crew, and grey for a model it does not know", () => {
    expect(
      crewLineClassColor(
        line({
          crewId: "c",
          crewNumber: 1,
          destination: "unassigned",
          inferredBoatType: "RS Quest",
        }),
      ),
    ).toBe("#2f9e46")
    expect(
      crewLineClassColor(
        line({
          crewId: "c",
          crewNumber: 1,
          destination: "boat",
          boat: { type: "Hobie 16", number: "1" },
        }),
      ),
    ).toBe("#6b8790")
  })
})

describe("crewCardLabel and modelOnlyName", () => {
  it("names the exact boat, Mezzi, the model without a boat, or no boat at all", () => {
    const boat = line({
      crewId: "a",
      crewNumber: 1,
      destination: "boat",
      boat: { type: "RS Quest", number: "2" },
    })
    const mezzi = line({ crewId: "b", crewNumber: 2, destination: "mezzi" })
    const modelOnly = line({
      crewId: "c",
      crewNumber: 3,
      inferredBoatType: "RS Quest",
    })
    const none = line({ crewId: "d", crewNumber: 4 })

    expect(crewCardLabel(boat)).toBe("RS Quest 2")
    expect(crewCardLabel(mezzi)).toBe("Mezzi")
    expect(crewCardLabel(modelOnly)).toBe("RS Quest · Senza barca")
    expect(crewCardLabel(none)).toBe("senza barca")
    expect(modelOnlyName(boat)).toBeNull()
    expect(modelOnlyName(mezzi)).toBeNull()
    expect(modelOnlyName(modelOnly)).toBe("RS Quest")
    expect(modelOnlyName(none)).toBeNull()
  })
})

describe("groupNumberWidthCh", () => {
  it("counts each digit as one ch and gives letters a margin, widest number of the group", () => {
    const line = (number: string | null) =>
      ({
        boat: number === null ? null : { number },
      }) as unknown as Parameters<typeof groupNumberWidthCh>[0][number]
    expect(groupNumberWidthCh([line("7"), line("12")])).toBe(2)
    expect(groupNumberWidthCh([line("12"), line("1234")])).toBe(4)
    expect(groupNumberWidthCh([line("A12")])).toBeCloseTo(3.4)
    expect(groupNumberWidthCh([line(null)])).toBe(0)
    expect(groupNumberWidthCh([])).toBe(0)
  })
})

describe("allStudentsAssigned", () => {
  const sections = (availableMembers: CrewSummaryMember[]) =>
    buildCrewSummarySections({
      title: "Sabato PM",
      lines: [],
      availableMembers,
      landMembers: [],
      emptyLabels: [],
    })

  it("is true with nobody available, and with only volunteers left", () => {
    expect(allStudentsAssigned(sections([]))).toBe(true)
    expect(
      allStudentsAssigned(sections([member("Vera ADV", { role: "ADV" })])),
    ).toBe(true)
  })

  it("is false while any student remains available", () => {
    expect(allStudentsAssigned(sections([member("Aldo")]))).toBe(false)
    expect(
      allStudentsAssigned(
        sections([member("Vera ADV", { role: "ADV" }), member("Aldo")]),
      ),
    ).toBe(false)
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
