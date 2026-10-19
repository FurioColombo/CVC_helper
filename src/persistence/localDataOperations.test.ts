import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  clearAppBrowserStorage: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: { close: mocks.close } }))
vi.mock("@/persistence/browserStorage", () => ({
  clearAppBrowserStorage: mocks.clearAppBrowserStorage,
}))
vi.mock("@/persistence/courseSession", () => ({
  invalidateCourseSession: vi.fn(),
  onCourseReplaced: vi.fn(() => () => {}),
}))

import { appChannelConfig } from "@/runtimeConfig"

const key = appChannelConfig.resetPendingKey

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => void values.set(name, value),
    removeItem: (name: string) => void values.delete(name),
  }
}

function deletingIndexedDb(outcome: "success" | "error" | "pending") {
  return {
    deleteDatabase: vi.fn(() => {
      const request: Record<string, (() => void) | null> = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      }
      if (outcome !== "pending")
        queueMicrotask(() =>
          outcome === "success" ? request.onsuccess?.() : request.onerror?.(),
        )
      return request
    }),
  }
}

async function load() {
  vi.resetModules()
  return import("@/persistence/localDataOperations")
}

describe("a full reset that the app may not live to finish", () => {
  let storage: ReturnType<typeof memoryStorage>

  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal("localStorage", storage)
    mocks.close.mockReset().mockResolvedValue(undefined)
    mocks.clearAppBrowserStorage.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("marks the reset pending before closing anything and clears the mark only once it completes", async () => {
    vi.stubGlobal("indexedDB", deletingIndexedDb("success"))
    const { isResetPending, resetAllLocalData, watchLocalData } = await load()
    const states: string[] = []
    watchLocalData((state) => states.push(state))
    mocks.close.mockImplementation(async () => {
      expect(storage.getItem(key)).toBe("1")
    })

    expect(isResetPending()).toBe(false)
    await resetAllLocalData()

    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.clearAppBrowserStorage).toHaveBeenCalledOnce()
    expect(isResetPending()).toBe(false)
    expect(states).toEqual(["resetting", "reset-complete"])
  })

  it("keeps the mark when deletion or cleanup fails, so the next open resumes it", async () => {
    vi.stubGlobal("indexedDB", deletingIndexedDb("error"))
    const first = await load()
    await first.resetAllLocalData()
    expect(first.isResetPending()).toBe(true)

    vi.stubGlobal("indexedDB", deletingIndexedDb("success"))
    mocks.clearAppBrowserStorage.mockRejectedValueOnce(new Error("cache"))
    const second = await load()
    await second.resetAllLocalData()
    expect(second.isResetPending()).toBe(true)

    const third = await load()
    await third.resetAllLocalData()
    expect(third.isResetPending()).toBe(false)
  })

  it("keeps the mark while the deletion is still waiting, as when the app is closed midway", async () => {
    vi.stubGlobal("indexedDB", deletingIndexedDb("pending"))
    const { isResetPending, resetAllLocalData } = await load()

    void resetAllLocalData()
    await vi.waitFor(() => expect(mocks.close).toHaveBeenCalled())

    expect(isResetPending()).toBe(true)
  })

  it("still resets without storage, only without the ability to resume", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
      removeItem: () => {
        throw new Error("denied")
      },
    })
    vi.stubGlobal("indexedDB", deletingIndexedDb("success"))
    const { isResetPending, resetAllLocalData } = await load()

    await resetAllLocalData()

    expect(mocks.clearAppBrowserStorage).toHaveBeenCalledOnce()
    expect(isResetPending()).toBe(false)
  })
})
