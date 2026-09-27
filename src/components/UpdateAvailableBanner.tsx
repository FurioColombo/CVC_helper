import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

/**
 * `vite.config.ts` registers the service worker with `registerType: "prompt"`
 * precisely so a background update never reloads the tab on its own — that
 * would discard whatever scan review or note the instructor has open. This is
 * the surface that asks instead: `src/main.tsx` flips `visible` once
 * `useRegisterSW` reports a waiting update, and `onUpdate` is wired to
 * `updateServiceWorker(true)`, which only runs when tapped.
 *
 * It positions itself just above the bottom navigation by measuring the
 * live `<nav>` element rather than hard-coding its height, so it keeps
 * working if that height ever changes and never covers it (rulebook R12).
 * When no `<nav>` is on screen (loading/onboarding), it falls back to the
 * viewport edge.
 */
export function UpdateAvailableBanner({
  visible,
  onUpdate,
}: {
  visible: boolean
  onUpdate: () => void
}) {
  const [navHeight, setNavHeight] = useState(0)
  // "Più tardi" hides it for this session; the update stays waiting and is
  // applied on the next launch or when the banner is shown again.
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!visible) return

    function measure() {
      // The app's bottom navigation, not any other nav on the screen (the crew
      // page has its own quick-access rail).
      const nav = document.querySelector(
        'nav[aria-label="Navigazione principale"]',
      )
      setNavHeight(nav?.getBoundingClientRect().height ?? 0)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [visible])

  if (!visible || dismissed) return null

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-md items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5 shadow-[0_-6px_20px_rgb(6_59_82/0.12)]"
      role="status"
      style={{ bottom: navHeight }}
    >
      <p className="min-w-0 flex-1 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
        Nuova versione disponibile
      </p>
      <Button
        className="h-11 min-h-11 shrink-0 px-3 text-sm"
        onClick={() => setDismissed(true)}
        type="button"
        variant="secondary"
      >
        Più tardi
      </Button>
      <Button
        aria-label="Aggiorna CVC Helper alla nuova versione"
        className="h-11 min-h-11 min-w-[44px] shrink-0 px-4 text-sm"
        onClick={onUpdate}
        type="button"
      >
        Aggiorna
      </Button>
    </div>
  )
}
