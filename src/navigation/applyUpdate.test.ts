import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { applyUpdateWhenSafe } from "@/navigation/applyUpdate"
import { useLeaveGuard } from "@/navigation/browserHistory"

/**
 * F1 review round 3, F1R3-7: the Aggiorna→requestLeave wiring in `main.tsx`
 * had no test at all (no test even rendered `Root`). This covers the wiring
 * itself, one level down, where it can be exercised without the service
 * worker: a registered leave guard must hold the update exactly like it holds
 * any other navigation, and a screen with nothing to lose must not delay it.
 */
describe("applyUpdateWhenSafe", () => {
  it("holds the update behind a registered leave guard until it releases it", () => {
    const update = vi.fn()
    let release: (() => void) | undefined
    const { unmount } = renderHook(() =>
      useLeaveGuard((leave) => {
        release = leave
        return true
      }),
    )

    applyUpdateWhenSafe(update)
    expect(update).not.toHaveBeenCalled()

    release?.()
    expect(update).toHaveBeenCalledOnce()

    unmount()
  })

  it("runs the update immediately when no screen is guarding it", () => {
    const update = vi.fn()

    applyUpdateWhenSafe(update)

    expect(update).toHaveBeenCalledOnce()
  })
})
