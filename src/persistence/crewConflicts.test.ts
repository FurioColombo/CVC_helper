import { describe, expect, it } from "vitest"

import { resolveCrews } from "@/persistence/placementConflicts"

const early = "2026-09-19T10:00:00.000Z"
const late = "2026-09-19T11:00:00.000Z"

const crew = (
  id: string,
  position: number | null,
  createdAt: string | null = early,
  boatId: string | null = null,
  updatedAt: string | null = createdAt,
) => ({
  id,
  position,
  createdAt,
  updatedAt,
  boatId,
  destination: boatId ? "boat" : "unassigned",
})
const member = (
  id: string,
  crewId: string,
  position: number | null,
  updatedAt: string | null = early,
) => ({ id, crewId, position, updatedAt })

describe("resolveCrews: positions", () => {
  it.each([
    ["sequential positions", [crew("a", 0), crew("b", 1)], ["a", "b"], 0],
    [
      "legacy null positions, row order kept",
      [crew("b", null), crew("a", null)],
      ["b", "a"],
      0,
    ],
    ["a gap", [crew("a", 0), crew("b", 2, early)], ["a", "b"], 1],
    [
      "the same position, earlier creation first",
      [crew("z", 0, late), crew("a", 0, early)],
      ["a", "z"],
      1,
    ],
    [
      "the same position and creation, id decides",
      [crew("b", 0), crew("a", 0)],
      ["a", "b"],
      1,
    ],
    [
      "a missing position after the numbered ones",
      [crew("c", null), crew("a", 1), crew("b", 1)],
      ["a", "b", "c"],
      1,
    ],
  ])("%s", (_name, crews, order, conflicts) => {
    const result = resolveCrews(crews, [])
    expect(result.crews.map(({ id }) => id)).toEqual(order)
    expect(result.conflicts).toBe(conflicts)
    if (conflicts > 0) {
      expect(result.crews.map(({ position }) => position)).toEqual(
        order.map((_id, index) => index),
      )
    }
  })
})

describe("resolveCrews: boats", () => {
  it.each([
    [
      "the later edit keeps the boat",
      [crew("a", 0, early, "boat", early), crew("b", 1, early, "boat", late)],
      { a: null, b: "boat" },
      1,
    ],
    [
      "the greater id keeps the boat on a tie",
      [crew("a", 0, early, "boat", late), crew("b", 1, early, "boat", late)],
      { a: null, b: "boat" },
      1,
    ],
    [
      "three crews on one boat leave two fixes",
      [
        crew("a", 0, early, "boat", early),
        crew("b", 1, early, "boat", late),
        crew("c", 2, early, "boat", early),
      ],
      { a: null, b: "boat", c: null },
      2,
    ],
    [
      "different boats are untouched",
      [crew("a", 0, early, "one"), crew("b", 1, early, "two")],
      { a: "one", b: "two" },
      0,
    ],
  ])("%s", (_name, crews, boats, conflicts) => {
    const result = resolveCrews(crews, [])
    expect(
      Object.fromEntries(result.crews.map(({ id, boatId }) => [id, boatId])),
    ).toEqual(boats)
    expect(result.conflicts).toBe(conflicts)
    // A crew that lost its boat keeps no boat destination.
    for (const { boatId, destination } of result.crews) {
      expect(destination === "boat").toBe(boatId !== null)
    }
  })
})

describe("resolveCrews: a boat outside the session's selection", () => {
  it.each([
    [
      "a boat that is not selected comes off the crew",
      [crew("a", 0, early, "x"), crew("b", 1, early, "y")],
      ["y"],
      { a: null, b: "y" },
      1,
    ],
    ["a selected boat stays", [crew("a", 0, early, "x")], ["x"], { a: "x" }, 0],
    [
      "no selection at all takes every boat off",
      [crew("a", 0, early, "x"), crew("b", 1, early, "y")],
      [],
      { a: null, b: null },
      2,
    ],
    [
      "an unselected boat is not also a claim",
      [
        crew("a", 0, early, "x", late),
        crew("b", 1, early, "y", early),
        crew("c", 2, early, "y", late),
      ],
      ["y"],
      { a: null, b: null, c: "y" },
      2,
    ],
  ])("%s", (_name, crews, selected, boats, conflicts) => {
    const result = resolveCrews(crews, [], {
      selectedBoatIds: new Set(selected),
    })
    expect(
      Object.fromEntries(result.crews.map(({ id, boatId }) => [id, boatId])),
    ).toEqual(boats)
    expect(result.conflicts).toBe(conflicts)
    for (const { boatId, destination } of result.crews) {
      expect(destination === "boat").toBe(boatId !== null)
    }
  })

  it("keeps the crew's people", () => {
    const result = resolveCrews(
      [crew("a", 0, early, "x")],
      [member("m", "a", 0)],
      {
        selectedBoatIds: new Set(),
      },
    )
    expect(result.members.map(({ id }) => id)).toEqual(["m"])
  })
})

describe("resolveCrews: a fixed crew size", () => {
  const sized = (members: ReturnType<typeof member>[], size: number | null) => {
    const result = resolveCrews([crew("c", 0)], members, {
      standardCrewSize: size,
    })
    return {
      order: result.members.map(({ id }) => id),
      positions: result.members.map(({ position }) => position),
      conflicts: result.conflicts,
    }
  }

  it.each([
    [
      "the earliest surplus member loses the place",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "c", 1, early),
      ],
      2,
      ["m2", "m3"],
      [0, 1],
      1,
    ],
    [
      "three on a slot of a crew of two: the latest two stay",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "c", 0, "2026-09-19T10:30:00.000Z"),
      ],
      2,
      ["m2", "m3"],
      [0, 1],
      2,
    ],
    [
      "a free slot within the size keeps everyone",
      [member("m1", "c", 0, early), member("m2", "c", 0, late)],
      2,
      ["m2", "m1"],
      [0, 1],
      1,
    ],
    [
      "no seat above within the size: the lowest free one",
      [member("m1", "c", 1, early), member("m2", "c", 1, late)],
      2,
      ["m1", "m2"],
      [0, 1],
      1,
    ],
    [
      "a flexible crew keeps everyone",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "c", 1, early),
      ],
      null,
      ["m2", "m3", "m1"],
      [0, 1, 2],
      1,
    ],
    [
      "a later edit from a higher slot is placed before an earlier one",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, "2026-09-19T10:30:00.000Z"),
        member("m3", "c", 1, "2026-09-19T09:00:00.000Z"),
        member("m4", "c", 1, late),
      ],
      3,
      ["m2", "m4", "m1"],
      [0, 1, 2],
      2,
    ],
  ])("%s", (_name, members, size, order, positions, conflicts) => {
    expect(sized(members, size)).toEqual({ order, positions, conflicts })
  })
})

describe("resolveCrews: member slots", () => {
  const slots = (
    members: ReturnType<typeof member>[],
    crews = [crew("c", 0)],
  ) => {
    const result = resolveCrews(crews, members)
    return {
      order: result.members.map(({ id }) => id),
      positions: result.members.map(({ position }) => position),
      conflicts: result.conflicts,
    }
  }

  it.each([
    [
      "distinct slots are untouched",
      [member("m1", "c", 0), member("m2", "c", 1)],
      ["m1", "m2"],
      [0, 1],
      0,
    ],
    [
      "legacy null slots are untouched",
      [member("m1", "c", null), member("m2", "c", null)],
      ["m1", "m2"],
      [null, null],
      0,
    ],
    [
      "a taken slot goes to the later edit, the other after it",
      [member("m1", "c", 0, early), member("m2", "c", 0, late)],
      ["m2", "m1"],
      [0, 1],
      1,
    ],
    [
      "a tie goes to the greater id",
      [member("m1", "c", 0, late), member("m2", "c", 0, late)],
      ["m2", "m1"],
      [0, 1],
      1,
    ],
    [
      "the other skips a slot already used",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "c", 1, early),
      ],
      ["m2", "m3", "m1"],
      [0, 1, 2],
      1,
    ],
    [
      "three people on one slot",
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "c", 0, "2026-09-19T10:30:00.000Z"),
      ],
      ["m2", "m3", "m1"],
      [0, 1, 2],
      2,
    ],
    [
      "an empty first slot stays empty",
      [member("m1", "c", 1, early), member("m2", "c", 1, late)],
      ["m2", "m1"],
      [1, 2],
      1,
    ],
  ])("%s", (_name, members, order, positions, conflicts) => {
    expect(slots(members)).toEqual({ order, positions, conflicts })
  })

  it("settles each crew on its own", () => {
    const result = resolveCrews(
      [crew("c", 0), crew("d", 1)],
      [
        member("m1", "c", 0, early),
        member("m2", "c", 0, late),
        member("m3", "d", 0, early),
      ],
    )
    expect(result.members.map(({ id, position }) => [id, position])).toEqual([
      ["m2", 0],
      ["m1", 1],
      ["m3", 0],
    ])
    expect(result.conflicts).toBe(1)
  })
})
