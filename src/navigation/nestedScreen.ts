import { useEffect, useRef, useState } from "react"

import {
  afterPendingBack,
  historyBack,
  holdBackNavigation,
} from "@/navigation/browserHistory"

/**
 * History keys of screens nested inside one area (a boat's detail, a new
 * fault, a volunteer form). The app shell drops them when it opens another
 * area, so a stale nested screen never follows the user elsewhere.
 */
export const NESTED_SCREEN_KEY_PREFIX = "__cvcHelperNested:"

function stateRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === "object"
    ? (state as Record<string, unknown>)
    : {}
}

/**
 * Local screens of one area that the phone's Back walks through like the
 * area's own Back buttons: opening a screen adds a history entry, and Back
 * returns to the screen before it instead of leaving the area.
 */
export function useNestedScreen<Screen>(
  area: string,
  root: Screen,
  parse: (value: unknown) => Screen | null,
) {
  const key = `${NESTED_SCREEN_KEY_PREFIX}${area}`
  const restore = useRef({ root, parse })
  useEffect(() => {
    restore.current = { root, parse }
  })
  const [screen, setScreen] = useState<Screen>(
    () => parse(stateRecord(window.history.state)[key]) ?? root,
  )

  useEffect(() => {
    function restoreScreen(event: PopStateEvent) {
      if (holdBackNavigation(event)) {
        event.stopImmediatePropagation()
        return
      }
      const { root, parse } = restore.current
      setScreen(parse(stateRecord(event.state)[key]) ?? root)
    }
    window.addEventListener("popstate", restoreScreen)
    return () => window.removeEventListener("popstate", restoreScreen)
  }, [key])

  function openScreen(next: Screen) {
    afterPendingBack(() => {
      window.history.pushState(
        { ...stateRecord(window.history.state), [key]: next },
        "",
        window.location.href,
      )
      setScreen(next)
    })
  }

  /** Returns to the previous screen; `fallback` only when none was recorded. */
  function closeScreen(fallback: Screen) {
    if (key in stateRecord(window.history.state)) {
      historyBack()
      return
    }
    setScreen(fallback)
  }

  return [screen, openScreen, closeScreen] as const
}
