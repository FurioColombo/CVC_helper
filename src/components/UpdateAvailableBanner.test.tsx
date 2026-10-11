import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner"
import type { UpdateCheck } from "@/navigation/updateChecks"
import { markReadOnly } from "@/persistence/writeGuard"

describe("UpdateAvailableBanner", () => {
  it("renders nothing when no update is waiting", () => {
    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible={false} />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows the Italian prompt and applies the update only when tapped", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent("Nuova versione disponibile")
    expect(onUpdate).not.toHaveBeenCalled()

    const button = screen.getByRole("button", {
      name: "Aggiorna CVC Helper alla nuova versione",
    })
    // 44 CSS px minimum touch target (rulebook R04).
    expect(button.className).toContain("min-h-11")
    expect(button.className).toContain("min-w-[44px]")

    await user.click(button)
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  // D3 review RH-3: the navigation publishes its height, so the bar sits on
  // it even when the offer was ready before the navigation was drawn.
  it("sits on the height the bottom navigation publishes, or on the edge without one", () => {
    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible />)

    expect(screen.getByRole("status").style.bottom).toBe(
      "var(--bottom-nav-height, 0px)",
    )
  })

  it("can be put off until later without applying the update", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

    await user.click(screen.getByRole("button", { name: "Più tardi" }))

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  // UG2-UX-3: the floating controls above the navigation rise by this height.
  it("publishes its height while shown, and withdraws it when put off", async () => {
    const height = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ height: 64 } as DOMRect)
    const user = userEvent.setup()
    const root = document.documentElement
    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible />)

    expect(root.style.getPropertyValue("--update-banner-height")).toBe("64px")

    await user.click(screen.getByRole("button", { name: "Più tardi" }))
    expect(root.style.getPropertyValue("--update-banner-height")).toBe("")
    height.mockRestore()
  })

  // D3: the data is newer than this version may write.
  describe("when the data is read-only", () => {
    it("stays, cannot be put off, and searches for the update on request", async () => {
      markReadOnly({} as never)
      const onCheck = vi.fn<() => Promise<UpdateCheck>>(async () => "none")
      const user = userEvent.setup()
      render(
        <UpdateAvailableBanner
          onCheck={onCheck}
          onUpdate={vi.fn()}
          visible={false}
        />,
      )

      const banner = screen.getByRole("status")
      expect(banner).toHaveTextContent(
        "Solo lettura: aggiorna l’app per salvare le modifiche.",
      )
      expect(
        screen.queryByRole("button", { name: "Più tardi" }),
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Cerca aggiornamento" }),
      )
      expect(onCheck).toHaveBeenCalledOnce()
      expect(
        await screen.findByText(
          "Nessuna versione più recente disponibile ora.",
        ),
      ).toBeVisible()
    })

    it("applies a version that is ready", async () => {
      markReadOnly({} as never)
      const onUpdate = vi.fn()
      const user = userEvent.setup()
      render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

      expect(screen.getByRole("status")).toHaveTextContent("Solo lettura")
      await user.click(
        screen.getByRole("button", {
          name: "Aggiorna CVC Helper alla nuova versione",
        }),
      )
      expect(onUpdate).toHaveBeenCalledOnce()
    })
  })
})
