import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UpdateCheckButton } from "@/components/UpdateCheckButton"
import {
  UPDATE_CHECK_MESSAGES,
  type UpdateCheck,
} from "@/navigation/updateChecks"
import { UpdatesProvider } from "@/navigation/updates"

function renderWith(offered: boolean, result: UpdateCheck = "none") {
  const updates = {
    offered,
    apply: vi.fn(),
    check: vi.fn(async () => result),
  }
  render(
    <UpdatesProvider value={updates}>
      <UpdateCheckButton />
    </UpdatesProvider>,
  )
  return updates
}

describe("UpdateCheckButton", () => {
  it.each(["none", "offline", "failed", "offered", "downloading"] as const)(
    "says what a check that finds %s means",
    async (result) => {
      const text = UPDATE_CHECK_MESSAGES[result]
      const user = userEvent.setup()
      const updates = renderWith(false, result)

      await user.click(
        screen.getByRole("button", { name: "Cerca aggiornamenti" }),
      )

      expect(updates.check).toHaveBeenCalledOnce()
      expect(await screen.findByText(text)).toBeVisible()
    },
  )

  it("applies a version that is ready instead of looking again", async () => {
    const user = userEvent.setup()
    const updates = renderWith(true)

    await user.click(
      screen.getByRole("button", { name: "Aggiorna alla nuova versione" }),
    )

    expect(updates.apply).toHaveBeenCalledOnce()
    expect(updates.check).not.toHaveBeenCalled()
  })
})
