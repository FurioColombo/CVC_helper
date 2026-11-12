import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WIND_ZONES } from "@/domain/windConfig"
import {
  REFRESH_AFTER_SECONDS,
  useWindForecast,
} from "@/features/weather/useWindForecast"
import { appChannelConfig } from "@/runtimeConfig"

// The course database is not opened here; the hook only listens for its end.
const localData = vi.hoisted(() => ({
  listeners: new Set<(state: string) => void>(),
}))
vi.mock("@/persistence/localDataOperations", () => ({
  watchLocalData: (listener: (state: string) => void) => {
    localData.listeners.add(listener)
    return () => localData.listeners.delete(listener)
  },
}))

const NOW = Date.UTC(2026, 10, 5, 8) / 1000
const key = `${appChannelConfig.weatherCachePrefix}v3.derive`

function payload(fetchedAt = NOW) {
  const hourly = {
    time: [fetchedAt, fetchedAt + 3600],
    wind_speed_10m_ecmwf_ifs: [10, 11],
    wind_direction_10m_ecmwf_ifs: [300, 300],
    wind_gusts_10m_ecmwf_ifs: [15, 16],
  }
  return WIND_ZONES.derive.points.map(() => ({ hourly }))
}

function stored(age: number) {
  const fetchedAt = NOW - age
  const column = (value: number) => [value, value]
  return JSON.stringify({
    fetchedAt,
    times: [NOW, NOW + 3600],
    points: {
      [WIND_ZONES.derive.points[0]!.id]: {
        ecmwf_ifs: {
          speed: column(10),
          direction: column(300),
          gust: column(15),
        },
      },
    },
  })
}

function respondWith(body: unknown) {
  return new Response(JSON.stringify(body))
}

describe("useWindForecast", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({
      now: NOW * 1000,
      shouldAdvanceTime: true,
      toFake: ["Date"],
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respondWith(payload())),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("cacheOnly never touches the network, with or without a copy, however old", async () => {
    const { unmount } = renderHook(() => useWindForecast("derive", "cacheOnly"))
    localStorage.setItem(key, stored(2 * 3600))
    const second = renderHook(() => useWindForecast("derive", "cacheOnly"))
    await act(async () => {
      window.dispatchEvent(new Event("online"))
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(second.result.current.forecast?.fetchedAt).toBe(NOW - 2 * 3600)
    unmount()
    second.unmount()
  })

  it("network downloads on opening, and not again while the copy is fresh", async () => {
    const first = renderHook(() => useWindForecast("derive", "network"))
    await waitFor(() => expect(first.result.current.state).toBe("idle"))
    await waitFor(() => expect(first.result.current.forecast).not.toBeNull())
    expect(localStorage.getItem(key)).not.toBeNull()
    first.unmount()
    vi.mocked(fetch).mockClear()
    const second = renderHook(() => useWindForecast("derive", "network"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    second.unmount()
  })

  it("refreshes when the phone comes back to an old forecast", async () => {
    localStorage.setItem(key, stored(60))
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    vi.setSystemTime((NOW + 8 * 3600) * 1000)
    vi.mocked(fetch).mockImplementation(async () =>
      respondWith(payload(NOW + 8 * 3600)),
    )
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).toHaveBeenCalled()
    await waitFor(() =>
      expect(result.current.forecast?.fetchedAt).toBe(NOW + 8 * 3600),
    )
    unmount()
  })

  it("writes nothing once the screen has left, whatever arrives later", async () => {
    let release: (response: Response) => void = () => undefined
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((resolve, reject) => {
          release = resolve
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    )
    const { unmount } = renderHook(() => useWindForecast("derive", "network"))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    unmount()
    localStorage.clear()
    release(respondWith(payload()))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("settles when the zone changes mid-download, instead of spinning for ever", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    )
    const { result, rerender, unmount } = renderHook(
      ({ zone }: { zone: "derive" | "cabinati" }) =>
        useWindForecast(zone, "network"),
      { initialProps: { zone: "derive" } },
    )
    await waitFor(() => expect(result.current.state).toBe("loading"))
    localStorage.setItem(key, stored(60))
    rerender({ zone: "cabinati" })
    rerender({ zone: "derive" })
    await waitFor(() => expect(result.current.state).not.toBe("failed"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(result.current.state).toBe("idle")
    unmount()
  })

  it("does not call a copy fresh when it was kept before its extras arrived", async () => {
    vi.mocked(fetch).mockImplementation(async () => respondWith(payload()))
    const whole = JSON.parse(stored(10 * 60)) as Record<string, unknown>
    localStorage.setItem(
      key,
      JSON.stringify({
        ...whole,
        sky: { code: [1, 1] },
        ensemble: { low: [8, 8], mid: [10, 10], high: [12, 12] },
      }),
    )
    const first = renderHook(() => useWindForecast("derive", "network"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    first.unmount()

    localStorage.setItem(key, stored(10 * 60))
    const second = renderHook(() => useWindForecast("derive", "network"))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    second.unmount()
  })

  it("keeps what was seen, even when the screen leaves before the extras arrive", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes("hourly=wind_speed_10m")) {
        return respondWith(payload())
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        )
      })
    })
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await waitFor(() => expect(result.current.forecast).not.toBeNull())
    expect(localStorage.getItem(key)).not.toBeNull()
    unmount()
    expect(localStorage.getItem(key)).not.toBeNull()
  })

  it("does not restart a running download when the phone comes back to it", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    )
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await waitFor(() => expect(result.current.state).toBe("loading"))
    const calls = vi.mocked(fetch).mock.calls.length
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls)
    expect(result.current.state).toBe("loading")
    unmount()
  })

  it("stops when another tab removes the forecast, and does not bring it back", async () => {
    let release: (response: Response) => void = () => undefined
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((resolve, reject) => {
          release = resolve
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    )
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await waitFor(() => expect(result.current.state).toBe("loading"))
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(result.current.state).toBe("idle")
    release(respondWith(payload()))
    vi.mocked(fetch).mockClear()
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(localStorage.getItem(key)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    unmount()
  })

  it("stops and keeps nothing when the course is erased, even before a first copy", async () => {
    // Another tab erasing the course has no key to remove yet, so no storage
    // event comes: the course's own notice must stop the download (SP-WX1-1).
    let release: (response: Response) => void = () => undefined
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((resolve, reject) => {
          release = resolve
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    )
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await waitFor(() => expect(result.current.state).toBe("loading"))
    expect(localStorage.getItem(key)).toBeNull()
    await act(async () => {
      for (const listener of localData.listeners) listener("changed")
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    release(respondWith(payload()))
    vi.mocked(fetch).mockClear()
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(localStorage.getItem(key)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    unmount()
  })

  it("drops a copy written just before the course's end was heard", async () => {
    localStorage.setItem(key, stored(60))
    const { unmount } = renderHook(() => useWindForecast("derive", "network"))
    await act(async () => {
      for (const listener of localData.listeners) listener("changed")
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(localStorage.getItem(key)).toBeNull()
    unmount()
    expect(localData.listeners.size).toBe(0)
  })

  it("does not retry by itself right after a failure, but does when signal returns", async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      throw new TypeError("no signal")
    })
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await waitFor(() => expect(result.current.state).toBe("failed"))
    vi.mocked(fetch).mockClear()
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    // Reopened meanwhile with nothing stored: it must say failed, not stay empty.
    const reopened = renderHook(() => useWindForecast("derive", "network"))
    await waitFor(() => expect(reopened.result.current.state).toBe("failed"))
    expect(fetch).not.toHaveBeenCalled()
    reopened.unmount()
    vi.mocked(fetch).mockImplementation(async () => respondWith(payload()))
    await act(async () => {
      window.dispatchEvent(new Event("online"))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).toHaveBeenCalled()
    unmount()
  })

  // The floor that keeps the centre inside Open-Meteo's limits (windBudget.test.ts).
  function wholeCopy(age: number) {
    const copy = JSON.parse(stored(age)) as Record<string, unknown>
    const column = (value: number) => [value, value]
    return JSON.stringify({
      ...copy,
      ensemble: { low: column(8), mid: column(10), high: column(12) },
      sky: { code: column(1), temperature: column(20), fetchedAt: NOW - age },
    })
  }

  async function downloadsOnOpening(age: number) {
    localStorage.setItem(key, wholeCopy(age))
    const { result, unmount } = renderHook(() =>
      useWindForecast("derive", "network"),
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(result.current.forecast?.sky).toBeDefined()
    unmount()
    return vi.mocked(fetch).mock.calls.length > 0
  }

  it("asks nothing when Vento reopens on a whole copy under 45 minutes old", async () => {
    expect(await downloadsOnOpening(REFRESH_AFTER_SECONDS - 60)).toBe(false)
  })

  it("asks again once the whole copy is 45 minutes old", async () => {
    expect(await downloadsOnOpening(REFRESH_AFTER_SECONDS + 60)).toBe(true)
  })

  it("waits the full floor when the extras were asked for and failed", async () => {
    // Every extra fails here: the ensemble's answer is not an ensemble's.
    const first = renderHook(() => useWindForecast("derive", "network"))
    await waitFor(() => expect(first.result.current.state).toBe("idle"))
    await waitFor(() => expect(localStorage.getItem(key)).not.toBeNull())
    expect(first.result.current.forecast?.ensemble).toBeUndefined()
    first.unmount()
    vi.mocked(fetch).mockClear()
    vi.setSystemTime((NOW + 10 * 60) * 1000)
    const again = renderHook(() => useWindForecast("derive", "network"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    again.unmount()
  })
})
