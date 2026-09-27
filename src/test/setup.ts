import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
  // Screens restore their nested screen from history.state, as after a
  // reload; one test's screen must not open the next test's component.
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", window.location.href)
  }
})
