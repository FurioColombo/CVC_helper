import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import type { UpdateCheck } from "@/navigation/updateChecks"
import { dataIsReadOnly, onReadOnly } from "@/persistence/writeGuard"

const CHECK_RESULT: Record<UpdateCheck | "checking", string> = {
  checking: "Ricerca di una nuova versione…",
  offered: "Nuova versione pronta.",
  downloading: "Nuova versione in arrivo: tra poco potrai aggiornare.",
  none: "Nessuna versione più recente disponibile ora.",
  offline: "Sei offline: cerca di nuovo quando c’è rete.",
  failed: "Ricerca non riuscita: riprova più tardi.",
}

/**
 * The app's one persistent bar of actions above the bottom navigation
 * (rulebook R12). `vite.config.ts` registers the service worker with
 * `registerType: "prompt"` precisely so a background update never reloads the
 * tab on its own — that would discard whatever scan review or note the
 * instructor has open. This bar asks instead: `src/main.tsx` sets `visible`
 * once a new version is waiting, and `onUpdate` applies it through the leave
 * guard, only when tapped.
 *
 * From D3 it also says when the data is read-only for this version
 * (src/persistence/writeGuard.ts): then it stays, cannot be put off, and
 * offers the update or a search for one, so the reason a save fails is on
 * screen wherever the instructor is.
 *
 * It sits on the bottom navigation, whose height the app shell publishes as
 * `--bottom-nav-height`, and publishes its own as `--update-banner-height`:
 * the floating controls (the crew page's rail and destination panels, the
 * Allievi add button), the shell's end padding and the focus scroll margin
 * rise by it, so it covers nothing (UG2-UX-3). With little width or large
 * text, the buttons move under the text rather than squeezing it.
 */
export function UpdateAvailableBanner({
  visible,
  onUpdate,
  onCheck,
}: {
  visible: boolean
  onUpdate: () => void
  onCheck?: () => Promise<UpdateCheck>
}) {
  const readOnly = useSyncExternalStore(onReadOnly, dataIsReadOnly, () => false)
  // "Più tardi" hides the offer for this session; the update stays waiting and
  // is applied on the next launch or from Impostazioni.
  const [dismissed, setDismissed] = useState(false)
  const [check, setCheck] = useState<UpdateCheck | "checking" | null>(null)
  const banner = useRef<HTMLDivElement>(null)
  const shown = readOnly || (visible && !dismissed)

  useLayoutEffect(() => {
    const element = banner.current
    if (!shown || !element) return
    const root = document.documentElement
    const publish = () =>
      root.style.setProperty(
        "--update-banner-height",
        `${element.getBoundingClientRect().height}px`,
      )
    publish()
    // The bar's height follows its text, the text size and the width.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish)
    observer?.observe(element)
    window.addEventListener("resize", publish)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", publish)
      root.style.removeProperty("--update-banner-height")
    }
  }, [shown])

  if (!shown) return null

  return (
    <div
      aria-live="polite"
      className={`fixed inset-x-0 z-10 mx-auto flex w-full max-w-md flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 shadow-[0_-6px_20px_rgb(6_59_82/0.12)] ${readOnly ? "border-[#e7c66b] bg-[#fff3cd] text-[#5c3d00]" : "border-border bg-card text-foreground"}`}
      ref={banner}
      role="status"
      style={{ bottom: "var(--bottom-nav-height, 0px)" }}
    >
      <p className="min-w-[10rem] flex-1 text-sm font-semibold [overflow-wrap:anywhere]">
        {readOnly ? (
          <>
            <span className="font-black">Solo lettura:</span> aggiorna l’app per
            salvare le modifiche.
          </>
        ) : (
          "Nuova versione disponibile"
        )}
        {readOnly && check && (
          <span className="mt-0.5 block font-normal">
            {CHECK_RESULT[check]}
          </span>
        )}
      </p>
      <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
        {!readOnly && (
          <Button
            className="h-11 min-h-11 px-3 text-sm"
            onClick={() => setDismissed(true)}
            type="button"
            variant="secondary"
          >
            Più tardi
          </Button>
        )}
        {visible ? (
          <Button
            aria-label="Aggiorna CVC Helper alla nuova versione"
            className="h-11 min-h-11 min-w-[44px] px-4 text-sm"
            onClick={onUpdate}
            type="button"
          >
            Aggiorna
          </Button>
        ) : (
          <Button
            className="h-11 min-h-11 px-4 text-sm"
            disabled={check === "checking" || !onCheck}
            onClick={async () => {
              if (!onCheck) return
              setCheck("checking")
              setCheck(await onCheck())
            }}
            type="button"
          >
            Cerca aggiornamento
          </Button>
        )}
      </div>
    </div>
  )
}
