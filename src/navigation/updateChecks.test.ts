import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkForUpdate,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_MIN_GAP_MS,
  watchForUpdates,
} from "@/navigation/updateChecks"

function registration(found: "installing" | "waiting" | null = null) {
  const state = {
    installing: null as object | null,
    waiting: null as object | null,
  }
  return Object.assign(state, {
    update: vi.fn(async () => {
      if (found) state[found] = {}
    }),
  })
}

describe("checkForUpdate", () => {
  it.each([
    ["installing", "downloading"],
    ["waiting", "offered"],
    [null, "none"],
  ] as const)("reports a version %s as %s", async (found, result) => {
    await expect(
      checkForUpdate(registration(found) as never, () => true),
    ).resolves.toBe(result)
  })

  it("does not ask offline, and tells a failure offline from one online", async () => {
    const offline = registration("waiting")
    await expect(checkForUpdate(offline as never, () => false)).resolves.toBe(
      "offline",
    )
    expect(offline.update).not.toHaveBeenCalled()

    const failing = registration()
    failing.update.mockRejectedValueOnce(new Error("network"))
    await expect(checkForUpdate(failing as never, () => true)).resolves.toBe(
      "failed",
    )
    await expect(checkForUpdate(undefined, () => true)).resolves.toBe("failed")
  })
})

describe("watchForUpdates", () => {
  let clock = 0
  const page = {
    visibilityState: "hidden" as DocumentVisibilityState,
    listeners: new Set<() => void>(),
    addEventListener(_type: string, listener: () => void) {
      this.listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      this.listeners.delete(listener)
    },
    show() {
      this.visibilityState = "visible"
      for (const listener of this.listeners) listener()
    },
  }

  beforeEach(() => {
    vi.useFakeTimers()
    clock = 0
    page.visibilityState = "hidden"
    page.listeners.clear()
  })
  afterEach(() => vi.useRealTimers())

  const watch = (target: ReturnType<typeof registration>) =>
    watchForUpdates(target as never, {
      now: () => clock,
      online: () => true,
      page: page as never,
    })

  it("checks when the app comes back to the foreground, once per quick return", () => {
    const target = registration()
    watch(target)

    clock = UPDATE_CHECK_MIN_GAP_MS
    page.show()
    expect(target.update).toHaveBeenCalledTimes(1)

    // Quick returns within the gap make one check, when the gap ends: not
    // several, and not none.
    page.show()
    clock += UPDATE_CHECK_MIN_GAP_MS / 2
    page.show()
    expect(target.update).toHaveBeenCalledTimes(1)
    clock += UPDATE_CHECK_MIN_GAP_MS / 2
    vi.advanceTimersByTime(UPDATE_CHECK_MIN_GAP_MS)
    expect(target.update).toHaveBeenCalledTimes(2)
  })

  it("checks every hour while the app stays open, and stops when asked", () => {
    const target = registration()
    const stop = watch(target)

    clock = UPDATE_CHECK_INTERVAL_MS
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    expect(target.update).toHaveBeenCalledTimes(1)

    stop()
    clock += UPDATE_CHECK_INTERVAL_MS
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    page.show()
    expect(target.update).toHaveBeenCalledTimes(1)
    expect(page.listeners.size).toBe(0)
  })

  it("leaves the start's own check alone: the next one waits for the gap", () => {
    const target = registration()
    watch(target)
    page.show()
    expect(target.update).not.toHaveBeenCalled()
    clock = UPDATE_CHECK_MIN_GAP_MS
    vi.advanceTimersByTime(UPDATE_CHECK_MIN_GAP_MS)
    expect(target.update).toHaveBeenCalledOnce()
  })
})
