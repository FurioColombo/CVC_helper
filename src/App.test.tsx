import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/probe", () => ({
  readPersistenceProbe: vi.fn(),
  incrementPersistenceProbe: vi.fn(),
}))

import { App } from "@/App"
import {
  incrementPersistenceProbe,
  readPersistenceProbe,
} from "@/persistence/probe"

const readProbe = vi.mocked(readPersistenceProbe)
const incrementProbe = vi.mocked(incrementPersistenceProbe)

describe("App foundation shell", () => {
  beforeEach(() => {
    readProbe.mockReset().mockResolvedValue(0)
    incrementProbe.mockReset().mockResolvedValue(1)
  })

  it("shows the local-first shell and verifies persisted storage", async () => {
    render(<App />)

    expect(
      screen.getByRole("heading", { name: "CVC Helper" }),
    ).toBeInTheDocument()
    const button = await screen.findByRole("button", {
      name: "Verifica persistenza",
    })
    await waitFor(() => expect(button).toBeEnabled())

    fireEvent.click(button)

    expect(await screen.findByText("Verifiche persistenti: 1")).toBeVisible()
  })
})
