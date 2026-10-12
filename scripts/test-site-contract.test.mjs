import { describe, expect, it } from "vitest"
import { assertTestPublicationAllowed } from "./test-site-contract.mjs"

const first = "a".repeat(40)
const later = "b".repeat(40)
const pin = {
  milestone: "D3",
  firstVersion: "0.4.0",
  secondVersion: "0.4.1",
  sourceCommit: first,
  activeVersion: "0.4.0",
  ownerInstalled: null,
}

describe("phone test publication stays pinned", () => {
  it("permits only the first verified source until installation is reported", () => {
    expect(() =>
      assertTestPublicationAllowed(pin, first, "0.4.0"),
    ).not.toThrow()
    expect(() => assertTestPublicationAllowed(pin, later, "0.4.0")).toThrow(
      /later work/,
    )
    expect(() => assertTestPublicationAllowed(pin, first, "0.4.1")).toThrow(
      /owner's explicit installation/,
    )
  })
  it("requires an explicit owner report to publish the same source's second patch", () => {
    const installed = {
      ...pin,
      ownerInstalled: {
        reportedBy: "owner",
        source: "Owner chat installation report",
        summary: "Installed CVC Helper Test 0.4.0 on Android",
      },
    }
    expect(() =>
      assertTestPublicationAllowed(installed, first, "0.4.1"),
    ).not.toThrow()
    expect(() =>
      assertTestPublicationAllowed(installed, later, "0.4.1"),
    ).toThrow(/later work/)
    expect(() =>
      assertTestPublicationAllowed(
        {
          ...installed,
          ownerInstalled: { ...installed.ownerInstalled, reportedBy: "agent" },
        },
        first,
        "0.4.1",
      ),
    ).toThrow(/owner's explicit/)
  })
  it("refuses skipped installation, downgrades and any unplanned version", () => {
    expect(() =>
      assertTestPublicationAllowed(
        { ...pin, activeVersion: null },
        first,
        "0.4.1",
      ),
    ).toThrow(/Install the first/)
    expect(() =>
      assertTestPublicationAllowed(
        { ...pin, activeVersion: "0.4.1" },
        first,
        "0.4.0",
      ),
    ).toThrow(/downgrade/)
    expect(() => assertTestPublicationAllowed(pin, first, "0.5.0")).toThrow(
      /two pinned patch/,
    )
  })
})
