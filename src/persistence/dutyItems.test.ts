import { describe, expect, it } from "vitest"

import { DUTY_SETTING_LISTS } from "@/domain/config"
import {
  dutySettingItemChanges,
  dutySettingItemId,
  dutySettingItems,
  dutySettingListsFrom,
} from "@/persistence/dutyItems"

const LISTS = {
  fewerDayIds: ["saturday", "tuesday"],
  extraDayIds: ["friday", "monday"],
  stayOverStudentIds: ["student-b", "student-a"],
  completedDayIds: ["saturday"],
  acknowledgedWarningKeys: ["minor-balance:2,0", "sex-balance:sunday"],
}

describe("duty-setting items", () => {
  it("store every list of the canonical table, item by item, in order", () => {
    const items = dutySettingItems("course-1", LISTS)

    expect(new Set(items.map(({ kind }) => kind))).toEqual(
      new Set(DUTY_SETTING_LISTS.map(({ kind }) => kind)),
    )
    expect(items.filter(({ kind }) => kind === "extra-day")).toEqual([
      {
        id: dutySettingItemId("course-1", "extra-day", "friday"),
        courseId: "course-1",
        kind: "extra-day",
        value: "friday",
        position: 0,
      },
      {
        id: dutySettingItemId("course-1", "extra-day", "monday"),
        courseId: "course-1",
        kind: "extra-day",
        value: "monday",
        position: 1,
      },
    ])
  })

  it("round-trip every list, whatever order the rows come in", () => {
    const items = dutySettingItems("course-1", LISTS)
    expect(dutySettingListsFrom([...items].reverse())).toEqual(LISTS)
  })

  it("store a repeated value once, at its first place", () => {
    const items = dutySettingItems("course-1", {
      stayOverStudentIds: ["student-a", "student-b", "student-a"],
    })
    expect(dutySettingListsFrom(items).stayOverStudentIds).toEqual([
      "student-a",
      "student-b",
    ])
  })

  it("give one item one id per course and kind, so a value cannot collide across them", () => {
    const ids = [
      dutySettingItemId("course-1", "fewer-day", "saturday"),
      dutySettingItemId("course-1", "completed-day", "saturday"),
      dutySettingItemId("course-2", "fewer-day", "saturday"),
      // Separators inside a value or a course id cannot forge another id.
      dutySettingItemId("course-1", "acknowledged-warning", 'a","b'),
      dutySettingItemId("course-1", "acknowledged-warning", "a"),
      dutySettingItemId('course-1","acknowledged-warning', "stay-over", "a"),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each([
    ["nothing", LISTS, {}],
    [
      "an added and a removed item",
      { ...LISTS, completedDayIds: ["sunday"] },
      { added: ["completed-day:sunday"], removed: ["completed-day:saturday"] },
    ],
    [
      "a reordered list as moves only",
      { ...LISTS, extraDayIds: ["monday", "friday"] },
      { moved: ["extra-day:monday@0", "extra-day:friday@1"] },
    ],
    [
      "an emptied list as removals",
      { ...LISTS, stayOverStudentIds: [] },
      {
        removed: ["stay-over:student-b", "stay-over:student-a"],
      },
    ],
  ])("change %s", (_case, wanted, expected) => {
    const stored = dutySettingItems("course-1", LISTS)
    const changes = dutySettingItemChanges(
      stored,
      dutySettingItems("course-1", wanted),
    )
    const byId = new Map(stored.map((item) => [item.id, item]))
    expect({
      added: changes.added.map(({ kind, value }) => `${kind}:${value}`),
      removed: changes.removedIds.map(
        (id) => `${byId.get(id)!.kind}:${byId.get(id)!.value}`,
      ),
      moved: changes.moved.map(
        ({ kind, value, position }) => `${kind}:${value}@${position}`,
      ),
    }).toEqual({ added: [], removed: [], moved: [], ...expected })
  })
})
