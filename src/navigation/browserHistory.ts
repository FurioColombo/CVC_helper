import { useEffect, useRef } from "react"

/**
 * A screen whose work must not be left behind silently (a failed save, an open
 * note, an edit that cannot be saved yet) registers a leave guard. The screen's
 * own Back, the bottom navigation and the phone's Back all ask it first, so no
 * route out bypasses the screen's explanation.
 *
 * A guard returns true to keep the user on the screen. It then says why, or
 * calls `leave` itself once the work is safe; `leave` completes the navigation
 * that was held.
 */
export type LeaveGuard = (leave: () => void) => boolean

const guards: LeaveGuard[] = []
let leaving = false
let passNextPop = false
// The phone's Back has already moved the history before popstate runs. A held
// Back is undone with forward(), whose own popstate must change nothing.
let restoringUntil = 0
let decided: { event: Event; held: boolean } | null = null

function restoreCurrentEntry() {
  restoringUntil = performance.now() + 1_000
  window.history.forward()
}

function closeActiveDialogOnBack() {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"]',
  )
  const dialog = dialogs.item(dialogs.length - 1)
  if (!dialog) return false

  // Restore the current screen, then let the dialog's existing Escape handler
  // close it.
  restoreCurrentEntry()
  dialog.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Escape",
    }),
  )
  return true
}

export function useLeaveGuard(guard: LeaveGuard | null) {
  const current = useRef(guard)
  useEffect(() => {
    current.current = guard
  })
  useEffect(() => {
    const entry: LeaveGuard = (leave) => current.current?.(leave) ?? false
    guards.push(entry)
    return () => {
      guards.splice(guards.indexOf(entry), 1)
    }
  }, [])
}

/** Runs `leave` now, unless the current screen's guard holds it. */
export function requestLeave(leave: () => void) {
  if (leaving) {
    leave()
    return
  }
  const proceed = () => {
    leaving = true
    try {
      leave()
    } finally {
      leaving = false
    }
  }
  if (guards.at(-1)?.(proceed)) return
  proceed()
}

// A Back the app started is still on its way: history.back() completes later,
// and an entry pushed before its popstate would be undone by it, putting the
// user back on the screen they had just left.
let pendingBack: { changes: Array<() => void>; timer: number } | null = null

function settleBack() {
  const settled = pendingBack
  pendingBack = null
  if (!settled) return
  window.clearTimeout(settled.timer)
  for (const change of settled.changes) change()
}

/** Goes one history entry back without asking the guards again. */
export function historyBack() {
  passNextPop = true
  // The fallback settles a Back whose popstate never comes.
  pendingBack ??= { changes: [], timer: window.setTimeout(settleBack, 1_000) }
  window.history.back()
}

/** Runs a history change once no Back started by the app is on its way. */
export function afterPendingBack(change: () => void) {
  if (pendingBack) pendingBack.changes.push(change)
  else change()
}

/**
 * Called first by every popstate listener. Returns true when this Back is
 * consumed (a dialog closed, a guard held the screen, or the undo of either);
 * the listener must then stop and leave the screen as it is. Every listener
 * gets the same answer for the same event.
 */
export function holdBackNavigation(event: PopStateEvent) {
  if (decided?.event === event) return decided.held
  const held = decideBack()
  decided = { event, held }
  return held
}

function decideBack() {
  if (restoringUntil > 0) {
    const restoring = performance.now() <= restoringUntil
    restoringUntil = 0
    if (restoring) return true
  }
  if (passNextPop) {
    passNextPop = false
    // After every popstate listener has restored its screen.
    if (pendingBack) window.setTimeout(settleBack, 0)
    return false
  }
  if (closeActiveDialogOnBack()) return true
  if (!guards.at(-1)?.(historyBack)) return false
  restoreCurrentEntry()
  return true
}
