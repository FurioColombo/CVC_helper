import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WeatherDisclosure } from "@/features/weather/WeatherDisclosure"

describe("WeatherDisclosure", () => {
  it("names both providers, what is sent and what they see, and connects to nothing", () => {
    vi.stubGlobal("fetch", vi.fn())
    render(<WeatherDisclosure />)
    const section = screen.getByRole("region", {
      name: "Previsioni del vento",
    })
    expect(section).toHaveTextContent(/Open-Meteo/)
    expect(section).toHaveTextContent(/LaMMA/)
    expect(section).toHaveTextContent(/coordinate fisse dell’area/)
    expect(section).toHaveTextContent(/nessun dato del corso/)
    expect(section).toHaveTextContent(
      /indirizzo della rete del telefono e l’ora/,
    )
    expect(section).toHaveTextContent(/La Home non si collega/)
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
