import { Component, type ReactNode } from "react"

import { clearCachedForecasts } from "@/features/weather/windData"

/**
 * Vento is optional: whatever goes wrong drawing it costs the forecast, never the
 * course. Home's strip sits on the screen every other screen returns to, so
 * without this a single bad value would close the whole app. The stored forecast
 * goes too, or the next start would fail the same way.
 */
export class WeatherBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    clearCachedForecasts()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
