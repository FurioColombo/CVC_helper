import { describe, expect, it } from "vitest"
import {
  acknowledgementFor,
  noticeSnapshot,
  pendingOwnerNotices,
} from "./owner-notices.mjs"

describe("owner action notifications", () => {
  const item = { id: "D3-PHONE", revision: 1, status: "NEEDS_SETUP" }
  const queue = { items: [item] }
  it("never acknowledges an action added between reading and announcing a notice", () => {
    const snapshot = noticeSnapshot(queue)
    const changed = { items: [item, { ...item, id: "D4-PHONE" }] }
    expect(() => acknowledgementFor(changed, snapshot)).toThrow(
      "changed after the notice",
    )
    expect(acknowledgementFor(queue, snapshot)).toEqual(
      acknowledgementFor(queue),
    )
  })
  it("announces additions and then stays quiet while unchanged", () => {
    expect(pendingOwnerNotices(queue)).toEqual([item])
    expect(pendingOwnerNotices(queue, acknowledgementFor(queue))).toEqual([])
  })
  it("announces a new build or a revised action", () => {
    const acknowledged = acknowledgementFor(queue)
    const ready = { ...item, revision: 2, status: "READY" }
    expect(pendingOwnerNotices({ items: [ready] }, acknowledged)).toEqual([
      ready,
    ])
    const revised = { ...item, revision: 2 }
    expect(pendingOwnerNotices({ items: [revised] }, acknowledged)).toEqual([
      revised,
    ])
  })
  it("does not nag about owner checks already passed", () => {
    expect(
      pendingOwnerNotices({
        items: [{ ...item, revision: 2, status: "PASSED" }],
      }),
    ).toEqual([])
  })
  it("keeps distinct item IDs even when titles or statuses are the same", () => {
    const other = { ...item, id: "D4-PHONE" }
    expect(
      pendingOwnerNotices({ items: [item, other] }, acknowledgementFor(queue)),
    ).toEqual([other])
  })
})
