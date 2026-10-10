import type { Transaction } from "@powersync/web"

import {
  DUTY_SETTING_LISTS,
  type DutySettingListField,
  type DutySettingListKind,
} from "@/domain/config"
import { TOUCH } from "@/persistence/stamp"

/**
 * D2: the lists of a course's duty settings stored item by item in
 * `dutySettingItems`, one row per item and kind, at its place in the list.
 * The id is made of the course, the kind and the value, so one item can be
 * stored only once, and the same item saved twice, or on two phones, is the
 * same row. The JSON lists in `dutySettings` stay the copy the app reads, and
 * are still written, while an app that knows only them can open the database
 * (03 §3, §3.1): the rows are written beside them, item by item, and
 * `repairDutySettingItems` (src/persistence/repairs.ts) keeps them identical
 * when such an app has written the lists or dropped the rows. No database
 * import: the repairs and the duty persistence share it.
 */

export interface DutySettingItem {
  id: string
  courseId: string
  kind: DutySettingListKind
  value: string
  position: number
}

export type DutySettingLists = Partial<
  Record<DutySettingListField, readonly string[]>
>

export const dutySettingItemId = (
  courseId: string,
  kind: DutySettingListKind,
  value: string,
) => JSON.stringify([courseId, kind, value])

/** The rows a course's lists are stored as; a repeated value is stored once. */
export function dutySettingItems(
  courseId: string,
  lists: DutySettingLists,
): DutySettingItem[] {
  return DUTY_SETTING_LISTS.flatMap(({ kind, field }) =>
    [...new Set(lists[field] ?? [])].map((value, position) => ({
      id: dutySettingItemId(courseId, kind, value),
      courseId,
      kind,
      value,
      position,
    })),
  )
}

/** Each list, in its stored order, from a course's rows. */
export function dutySettingListsFrom(items: readonly DutySettingItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.position - b.position || a.value.localeCompare(b.value),
  )
  return Object.fromEntries(
    DUTY_SETTING_LISTS.map(({ kind, field }) => [
      field,
      sorted.filter((item) => item.kind === kind).map(({ value }) => value),
    ]),
  ) as Record<DutySettingListField, string[]>
}

export interface DutySettingItemChanges {
  added: DutySettingItem[]
  removedIds: string[]
  moved: DutySettingItem[]
}

/** A stored row says what its id says: its course, kind and value. */
const sameItem = (a: DutySettingItem, b: DutySettingItem) =>
  a.courseId === b.courseId && a.kind === b.kind && a.value === b.value

/**
 * What turns the stored rows into the wanted ones, item by item. A row whose
 * course, kind or value disagrees with its id is replaced, not trusted.
 */
export function dutySettingItemChanges(
  stored: readonly DutySettingItem[],
  wanted: readonly DutySettingItem[],
): DutySettingItemChanges {
  const storedById = new Map(stored.map((item) => [item.id, item]))
  const wantedById = new Map(wanted.map((item) => [item.id, item]))
  return {
    added: wanted.filter((item) => {
      const current = storedById.get(item.id)
      return !current || !sameItem(current, item)
    }),
    removedIds: stored
      .filter((item) => {
        const target = wantedById.get(item.id)
        return !target || !sameItem(item, target)
      })
      .map(({ id }) => id),
    moved: wanted.filter((item) => {
      const current = storedById.get(item.id)
      return (
        current !== undefined &&
        sameItem(current, item) &&
        current.position !== item.position
      )
    }),
  }
}

export const hasDutySettingItemChanges = ({
  added,
  removedIds,
  moved,
}: DutySettingItemChanges) =>
  added.length + removedIds.length + moved.length > 0

/** Writes the changes, inside the caller's transaction; removals first. */
export async function writeDutySettingItemChanges(
  transaction: Pick<Transaction, "execute" | "executeBatch">,
  { added, removedIds, moved }: DutySettingItemChanges,
  now: string,
) {
  if (removedIds.length > 0) {
    await transaction.executeBatch(
      "DELETE FROM dutySettingItems WHERE id = ?",
      removedIds.map((id) => [id]),
    )
  }
  if (moved.length > 0) {
    await transaction.executeBatch(
      `UPDATE dutySettingItems SET position = ?, ${TOUCH} WHERE id = ?`,
      moved.map(({ id, position }) => [position, now, id]),
    )
  }
  if (added.length > 0) {
    await transaction.executeBatch(
      `INSERT INTO dutySettingItems(
         id, courseId, kind, value, position, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      added.map(({ id, courseId, kind, value, position }) => [
        id,
        courseId,
        kind,
        value,
        position,
        now,
        now,
      ]),
    )
  }
}
