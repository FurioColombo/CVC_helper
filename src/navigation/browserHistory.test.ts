import { describe, expect, it } from "vitest"

import {
  afterPendingBack,
  historyBack,
  holdBackNavigation,
} from "@/navigation/browserHistory"

function nextPopState() {
  return new Promise<void>((resolve) =>
    window.addEventListener("popstate", () => resolve(), { once: true }),
  )
}

describe("afterPendingBack", () => {
  it("pushes a new entry only after a Back the app started has landed", async () => {
    // Every popstate listener in the app asks holdBackNavigation first.
    const listener = (event: PopStateEvent) => {
      holdBackNavigation(event)
    }
    window.addEventListener("popstate", listener)
    try {
      window.history.pushState({ screen: "boat" }, "")
      window.history.pushState({ screen: "new fault" }, "")
      const landed = nextPopState()
      // Saving the fault closes its screen with Back; the user taps Home at
      // once, before that Back has landed.
      historyBack()
      let pushed = false
      afterPendingBack(() => {
        window.history.pushState({ screen: "home" }, "")
        pushed = true
      })
      expect(pushed).toBe(false)

      await landed
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(pushed).toBe(true)
      // Home stays: the Back cannot undo an entry pushed after it landed.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(window.history.state).toEqual({ screen: "home" })
    } finally {
      window.removeEventListener("popstate", listener)
    }
  })

  it("changes the history at once when no Back is on its way", () => {
    let ran = false
    afterPendingBack(() => {
      ran = true
    })
    expect(ran).toBe(true)
  })
})
