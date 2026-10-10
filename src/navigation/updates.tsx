import { createContext, useContext } from "react"

import type { UpdateCheck } from "@/navigation/updateChecks"

/**
 * The app's update state, provided by `Root` (src/main.tsx), the one place
 * that touches the service worker: whether a new version is waiting, a way to
 * apply it through the leave guard, and a check on request (Impostazioni,
 * the read-only notice).
 */
export interface Updates {
  offered: boolean
  apply: () => void
  check: () => Promise<UpdateCheck>
}

const UpdatesContext = createContext<Updates>({
  offered: false,
  apply: () => {},
  check: async () => "failed",
})

export const UpdatesProvider = UpdatesContext.Provider

export function useUpdates() {
  return useContext(UpdatesContext)
}
