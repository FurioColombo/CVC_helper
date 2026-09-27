import { requestLeave } from "@/navigation/browserHistory"

/**
 * Applying a waiting service-worker update reloads the app, which is exactly
 * as destructive to whatever is on screen as leaving it any other way (a
 * half-finished review, an open note, a failed save not yet retried). Routing
 * it through the same leave guard as Back and the bottom navigation means a
 * screen with unsaved work gets the same chance to ask first, or to finish
 * saving, before the reload actually happens (F1 review round 3, F1R3-7:
 * regression coverage for the `main.tsx` wiring, which had none).
 */
export function applyUpdateWhenSafe(update: () => void) {
  requestLeave(update)
}
