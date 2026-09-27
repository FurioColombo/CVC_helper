import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner"

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

  it("sits just above the live bottom navigation instead of covering it", () => {
    // Another navigation earlier on the page (the crew quick-access rail)
    // must not be mistaken for the bottom navigation.
    const rail = document.createElement("nav")
    rail.setAttribute("aria-label", "Accesso rapido equipaggi")
    document.body.appendChild(rail)
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
      height: 400,
    } as DOMRect)
    const nav = document.createElement("nav")
    nav.setAttribute("aria-label", "Navigazione principale")
    document.body.appendChild(nav)
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue({
      height: 72,
    } as DOMRect)

    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible />)

    expect(screen.getByRole("status")).toHaveStyle({ bottom: "72px" })

    document.body.removeChild(nav)
    document.body.removeChild(rail)
  })

  it("can be put off until later without applying the update", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

    await user.click(screen.getByRole("button", { name: "Più tardi" }))

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("falls back to the viewport edge when no navigation is on screen", () => {
    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible />)

    expect(screen.getByRole("status")).toHaveStyle({ bottom: "0px" })
  })
})
