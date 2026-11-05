import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WIND_ZONES } from "@/domain/windConfig"
import { useWindForecast } from "@/features/weather/useWindForecast"
import { appChannelConfig } from "@/runtimeConfig"

const NOW = Date.UTC(2026, 10, 5, 8) / 1000
const key = `${appChannelConfig.weatherCachePrefix}v2.derive`

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
})
