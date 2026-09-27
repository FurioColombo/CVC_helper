import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { useRegisterSW } from "virtual:pwa-register/react"

import { App } from "@/App"
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner"
import { applyUpdateWhenSafe } from "@/navigation/applyUpdate"
import "@/styles.css"

/**
 * `registerType: "prompt"` in vite.config.ts means a waiting update never
 * reloads the tab by itself; `useRegisterSW` only flags `needRefresh`, and
 * `updateServiceWorker(true)` is what actually applies it (sending
 * skip-waiting, then reloading once the new worker takes control). This
 * component is the only place that touches the virtual `pwa-register`
 * module, so `UpdateAvailableBanner` itself stays a plain, unit-testable
 * component.
 */
export function Root() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  return (
    <StrictMode>
      <App />
      <UpdateAvailableBanner
        // Applying the update reloads the app, so it asks the current
        // screen first, exactly like leaving it: an unsaved review, an open
        // note or a failed save is not discarded without a choice.
        onUpdate={() =>
          applyUpdateWhenSafe(() => void updateServiceWorker(true))
        }
        visible={needRefresh}
      />
    </StrictMode>
  )
}

createRoot(document.getElementById("root")!).render(<Root />)
