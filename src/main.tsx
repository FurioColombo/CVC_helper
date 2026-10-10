import { StrictMode, useMemo, useRef } from "react"
import { createRoot } from "react-dom/client"
import { useRegisterSW } from "virtual:pwa-register/react"

import { App } from "@/App"
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner"
import { applyUpdateWhenSafe } from "@/navigation/applyUpdate"
import { checkForUpdate, watchForUpdates } from "@/navigation/updateChecks"
import { UpdatesProvider, type Updates } from "@/navigation/updates"
import "@/styles.css"

/**
 * `registerType: "prompt"` in vite.config.ts means a waiting update never
 * reloads the tab by itself; `useRegisterSW` only flags `needRefresh`, and
 * `updateServiceWorker(true)` is what actually applies it (sending
 * skip-waiting, then reloading once the new worker takes control). This
 * component is the only place that touches the virtual `pwa-register`
 * module, so `UpdateAvailableBanner` itself stays a plain, unit-testable
 * component. From D3 it also looks for a new version whenever the app comes
 * back to the foreground and once an hour (src/navigation/updateChecks.ts),
 * and shares the update state with the screens that offer it.
 */
export function Root() {
  const registration = useRef<ServiceWorkerRegistration>(undefined)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registered) {
      if (!registered) return
      registration.current = registered
      watchForUpdates(registered)
    },
  })

  const updates = useMemo<Updates>(
    () => ({
      offered: needRefresh,
      // Applying the update reloads the app, so it asks the current screen
      // first, exactly like leaving it: an unsaved review, an open note or a
      // failed save is not discarded without a choice.
      apply: () => applyUpdateWhenSafe(() => void updateServiceWorker(true)),
      check: () => checkForUpdate(registration.current),
    }),
    [needRefresh, updateServiceWorker],
  )

  return (
    <StrictMode>
      <UpdatesProvider value={updates}>
        <App />
      </UpdatesProvider>
      <UpdateAvailableBanner onUpdate={updates.apply} visible={needRefresh} />
    </StrictMode>
  )
}

createRoot(document.getElementById("root")!).render(<Root />)
