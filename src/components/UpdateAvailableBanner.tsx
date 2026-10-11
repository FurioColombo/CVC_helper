import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { X } from "lucide-react"

import { APP_VERSION_TEXT } from "@/appVersion"
import { Button } from "@/components/ui/button"
import { noteInstalledVersion } from "@/navigation/installedVersion"
import {
  UPDATE_CHECK_MESSAGES,
  type UpdateCheck,
} from "@/navigation/updateChecks"
import { dataIsReadOnly, onReadOnly } from "@/persistence/writeGuard"

/** Taps in this window after the bar appears are not taken (D3 FU-7). */
export const BAR_TAP_DELAY_MS = 800

/**
 * The app's one persistent bar of actions above the bottom navigation
 * (rulebook R12). `vite.config.ts` registers the service worker with
 * `registerType: "prompt"` precisely so a background update never reloads the
 * tab on its own — that would discard whatever scan review or note the
 * instructor has open. This bar asks instead: `src/main.tsx` sets `visible`
 * once a new version is waiting, and `onUpdate` applies it through the leave
 * guard, only when tapped.
 *
 * From D3 it also says, in order of importance, when the data is read-only for
 * this version (src/persistence/writeGuard.ts; it then stays, and offers the
 * update or a search for one, so the reason a save fails is on screen wherever
 * the instructor is), and once, after an update, which version is now
 * installed.
 *
 * It sits on the bottom navigation, whose height the app shell publishes as
 * `--bottom-nav-height`, above the page's own content, and publishes its own
 * height as `--update-banner-height`: the crew page's column (and so its
 * quick-access rail), its destination panels, the Allievi add button, the
 * shell's end padding and the focus scroll margin rise by it, so it covers no
 * control (UG2-UX-3). With little width or large text, the buttons move under
 * the text and onto further lines rather than out of the bar, and keep to its
 * lower edge, so a search's answer growing the text does not move them (D3
 * review FU-Q9). A bar that has just appeared, moving the controls under a
 * thumb already on its way, takes no tap for a moment (FU-7).
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
  // Read once per start: a newer version than last time means an update.
  const [updatedNote, setUpdatedNote] = useState(
    () => noteInstalledVersion(APP_VERSION_TEXT) !== null,
  )
  const [check, setCheck] = useState<UpdateCheck | "checking" | null>(null)
  // The buttons that take taps: each new set waits BAR_TAP_DELAY_MS.
  const [armedFor, setArmedFor] = useState<string | null>(null)
  const banner = useRef<HTMLDivElement>(null)
  const offer = visible && !dismissed
  const state = readOnly
    ? "read-only"
    : offer
      ? "offer"
      : updatedNote
        ? "updated"
        : null
  // A version that becomes ready while read-only swaps the search for Aggiorna.
  const buttons = state && `${state}:${visible}`

  useLayoutEffect(() => {
    const element = banner.current
    if (!state || !element) return
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
  }, [state])

  useEffect(() => {
    if (!buttons) return
    const timer = window.setTimeout(
      () => setArmedFor(buttons),
      BAR_TAP_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [buttons])

  if (!state) return null

  const armed = armedFor === buttons
  // Not yet armed, a button says so to assistive technology (and to the
  // browser tests, which wait for it) without dimming for so short a time.
  const whenArmed = (action: () => void) => ({
    "aria-disabled": armed ? undefined : true,
    onClick: () => {
      if (armed) action()
    },
  })
  const buttonClass =
    "h-auto min-h-11 whitespace-normal px-3 py-2 text-sm leading-tight"

  return (
    <div
      aria-live="polite"
      className={`fixed inset-x-0 z-30 mx-auto flex w-full max-w-md flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 shadow-[0_-6px_20px_rgb(6_59_82/0.12)] ${state === "read-only" ? "border-[#e7c66b] bg-[#fff3cd] text-[#5c3d00]" : "border-border bg-card text-foreground"}`}
      ref={banner}
      role="status"
      style={{ bottom: "var(--bottom-nav-height, 0px)" }}
    >
      <p className="min-w-0 flex-[1_1_10rem] text-sm font-semibold [overflow-wrap:anywhere]">
        {state === "read-only" && (
          <>
            <span className="font-black">Sola lettura:</span> aggiorna l’app per
            salvare le modifiche.
          </>
        )}
        {state === "offer" && "Nuova versione disponibile"}
        {state === "updated" &&
          `CVC Helper è aggiornata alla versione ${APP_VERSION_TEXT}.`}
        {state === "read-only" && check && !visible && (
          <span className="mt-0.5 block font-normal">
            {UPDATE_CHECK_MESSAGES[check]}
          </span>
        )}
      </p>
      <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-3 self-end">
        {state === "offer" && (
          <Button
            className={buttonClass}
            {...whenArmed(() => setDismissed(true))}
            type="button"
            variant="secondary"
          >
            Più tardi
          </Button>
        )}
        {state === "updated" && (
          <Button
            aria-label="Chiudi l’avviso di aggiornamento"
            className="size-11 shrink-0 p-0"
            {...whenArmed(() => setUpdatedNote(false))}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        )}
        {state !== "updated" &&
          (visible ? (
            <Button
              aria-label="Aggiorna CVC Helper alla nuova versione"
              className={`${buttonClass} min-w-[44px]`}
              {...whenArmed(onUpdate)}
              type="button"
            >
              Aggiorna
            </Button>
          ) : (
            <Button
              className={buttonClass}
              disabled={check === "checking" || !onCheck}
              {...whenArmed(async () => {
                if (!onCheck) return
                setCheck("checking")
                setCheck(await onCheck())
              })}
              type="button"
            >
              Cerca aggiornamenti
            </Button>
          ))}
      </div>
    </div>
  )
}
