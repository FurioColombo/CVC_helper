import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WeatherBoundary } from "@/features/weather/WeatherBoundary"
import { appChannelConfig } from "@/runtimeConfig"

function Broken(): never {
  throw new Error("valore impossibile")
}

describe("WeatherBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("costs the forecast, not the course, and drops the copy that caused it", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const key = `${appChannelConfig.weatherCachePrefix}v3.derive`
    localStorage.setItem(key, "{}")
    localStorage.setItem("other", "kept")
    render(
      <WeatherBoundary fallback={<p>Vento non disponibile</p>}>
        <Broken />
      </WeatherBoundary>,
    )
    expect(screen.getByText("Vento non disponibile")).toBeTruthy()
    expect(localStorage.getItem(key)).toBeNull()
    expect(localStorage.getItem("other")).toBe("kept")
  })
})
