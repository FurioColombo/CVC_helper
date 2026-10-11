import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  BAR_TAP_DELAY_MS,
  UpdateAvailableBanner,
} from "@/components/UpdateAvailableBanner"
import {
  UPDATE_CHECK_MESSAGES,
  type UpdateCheck,
} from "@/navigation/updateChecks"
import { markReadOnly } from "@/persistence/writeGuard"

/** The bar's button, once it takes taps (D3 FU-7). */
async function armed(name: string) {
  const button = screen.getByRole("button", { name })
  await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"), {
    timeout: BAR_TAP_DELAY_MS * 3,
  })
  return button
}

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

    const button = await armed("Aggiorna CVC Helper alla nuova versione")
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

  // D3 review FU-7: a thumb already on its way when the bar appears does not
  // apply or put off an update it has not read.
  it("takes no tap in the moment after it appears", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

    const update = screen.getByRole("button", {
      name: "Aggiorna CVC Helper alla nuova versione",
    })
    expect(update).toHaveAttribute("aria-disabled", "true")
    await user.click(update)
    await user.click(screen.getByRole("button", { name: "Più tardi" }))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toBeInTheDocument()
    await user.click(await armed("Aggiorna CVC Helper alla nuova versione"))
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it("can be put off until later without applying the update", async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

    await user.click(await armed("Più tardi"))

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

    await user.click(await armed("Più tardi"))
    expect(root.style.getPropertyValue("--update-banner-height")).toBe("")
    height.mockRestore()
  })

  // D3 review FU-8: the note is a state of this bar, so it pushes no page.
  it("says once, after an update, which version is now installed", async () => {
    window.localStorage.setItem("cvc-helper.installed-version", "0.0.1")
    const user = userEvent.setup()
    const { unmount } = render(
      <UpdateAvailableBanner onUpdate={vi.fn()} visible={false} />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      `CVC Helper è aggiornata alla versione ${import.meta.env.VITE_APP_VERSION}.`,
    )
    await user.click(await armed("Chiudi l’avviso di aggiornamento"))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    unmount()

    // The next start says nothing more.
    render(<UpdateAvailableBanner onUpdate={vi.fn()} visible={false} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
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
        "Sola lettura: aggiorna l’app per salvare le modifiche.",
      )
      expect(
        screen.queryByRole("button", { name: "Più tardi" }),
      ).not.toBeInTheDocument()

      await user.click(await armed("Cerca aggiornamenti"))
      expect(onCheck).toHaveBeenCalledOnce()
      expect(await screen.findByText(UPDATE_CHECK_MESSAGES.none)).toBeVisible()
    })

    // D3 review RH2-Q2: what the search found gives way to the version that
    // became ready, whose Aggiorna again waits a moment for taps.
    it("drops the search's answer once a version is ready", async () => {
      markReadOnly({} as never)
      const user = userEvent.setup()
      const onUpdate = vi.fn()
      const bar = (visible: boolean) => (
        <UpdateAvailableBanner
          onCheck={async () => "downloading"}
          onUpdate={onUpdate}
          visible={visible}
        />
      )
      const { rerender } = render(bar(false))
      await user.click(await armed("Cerca aggiornamenti"))
      expect(
        await screen.findByText(UPDATE_CHECK_MESSAGES.downloading),
      ).toBeVisible()

      rerender(bar(true))

      expect(screen.queryByText(UPDATE_CHECK_MESSAGES.downloading)).toBeNull()
      const update = screen.getByRole("button", {
        name: "Aggiorna CVC Helper alla nuova versione",
      })
      expect(update).toHaveAttribute("aria-disabled", "true")
      await user.click(await armed("Aggiorna CVC Helper alla nuova versione"))
      expect(onUpdate).toHaveBeenCalledOnce()
    })

    it("applies a version that is ready", async () => {
      markReadOnly({} as never)
      const onUpdate = vi.fn()
      const user = userEvent.setup()
      render(<UpdateAvailableBanner onUpdate={onUpdate} visible />)

      expect(screen.getByRole("status")).toHaveTextContent("Sola lettura")
      await user.click(await armed("Aggiorna CVC Helper alla nuova versione"))
      expect(onUpdate).toHaveBeenCalledOnce()
    })
  })
})
