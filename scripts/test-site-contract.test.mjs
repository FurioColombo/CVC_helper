import { describe, expect, it } from "vitest"
import { assertTestPublicationAllowed } from "./test-site-contract.mjs"

const first = "a".repeat(40)
const later = "b".repeat(40)
const pin = {
  milestone: "D3",
  versions: ["0.4.0", "0.4.1"],
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
      /pinned patch/,
    )
  })
})

describe("a later milestone replaces the installed build only after its owner check", () => {
  const replacing = {
    milestone: "D4",
    versions: ["0.4.2"],
    sourceCommit: later,
    activeVersion: "0.4.1",
    ownerInstalled: null,
    replaces: {
      milestone: "D3",
      ownerCheck: "D3-PHONE-UPDATE",
      activeVersion: "0.4.1",
    },
  }
  const queue = (status) => ({
    items: [{ id: "D3-PHONE-UPDATE", status }],
  })

  it("publishes the next patch once the replaced check has passed", () => {
    expect(() =>
      assertTestPublicationAllowed(replacing, later, "0.4.2", queue("PASSED")),
    ).not.toThrow()
  })
  it("keeps the installed build while its check is pending or failed", () => {
    for (const status of ["READY", "NEEDS_SETUP", "CHANGES_REQUESTED"])
      expect(() =>
        assertTestPublicationAllowed(replacing, later, "0.4.2", queue(status)),
      ).toThrow(/stays until its owner check passes/)
    expect(() =>
      assertTestPublicationAllowed(replacing, later, "0.4.2", { items: [] }),
    ).toThrow(/stays until/)
  })
  it("refuses the earlier source, a version that would not update and a downgrade", () => {
    expect(() =>
      assertTestPublicationAllowed(replacing, first, "0.4.2", queue("PASSED")),
    ).toThrow(/later work/)
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, versions: ["0.4.1"] },
        later,
        "0.4.1",
        queue("PASSED"),
      ),
    ).toThrow(/must update the installed one/)
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, versions: ["0.4.0"] },
        later,
        "0.4.0",
        queue("PASSED"),
      ),
    ).toThrow(/must update the installed one/)
  })
  it("refuses inconsistent pins that would swap the build under a pending check (SP-R4-1)", () => {
    const pending = {
      items: [
        { id: "D3-PHONE-UPDATE", status: "READY" },
        { id: "D4-PHONE-TRANSFER", status: "NEEDS_SETUP" },
      ],
    }
    // A later pin that does not declare the live build it replaces.
    expect(() =>
      assertTestPublicationAllowed(
        {
          milestone: "D5",
          versions: ["0.4.3"],
          sourceCommit: later,
          activeVersion: "0.4.2",
        },
        later,
        "0.4.3",
        pending,
      ),
    ).toThrow(/declare the build this pin replaces/)
    // A replacing pin that has forgotten which build is live.
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, activeVersion: null },
        later,
        "0.4.2",
        pending,
      ),
    ).toThrow(/this pin's or the one it replaces/)
    // A stale live version that is not the replaced build.
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, activeVersion: "0.4.0" },
        later,
        "0.4.2",
        pending,
      ),
    ).toThrow(/this pin's or the one it replaces/)
    // The consistent pin still waits for the replaced check.
    expect(() =>
      assertTestPublicationAllowed(replacing, later, "0.4.2", pending),
    ).toThrow(/stays until its owner check passes/)
  })
  it("republishes its own active version without consulting the replaced check", () => {
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, activeVersion: "0.4.2" },
        later,
        "0.4.2",
        queue("READY"),
      ),
    ).not.toThrow()
  })
})

describe("the 0.5.0 cycle's first test build replaces 0.4.4", () => {
  const replacing = {
    milestone: "B3",
    versions: ["0.5.0"],
    sourceCommit: later,
    activeVersion: "0.4.4",
    ownerInstalled: null,
    replaces: {
      milestone: "UG3",
      ownerCheck: "UG3-PHONE-RELEASE",
      activeVersion: "0.4.4",
    },
  }
  const queue = (status) => ({
    items: [{ id: "UG3-PHONE-RELEASE", status }],
  })

  it("orders a new minor line after the old patches", () => {
    expect(() =>
      assertTestPublicationAllowed(replacing, later, "0.5.0", queue("PASSED")),
    ).not.toThrow()
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, versions: ["0.3.9"] },
        later,
        "0.3.9",
        queue("PASSED"),
      ),
    ).toThrow(/must update the installed one/)
    expect(() =>
      assertTestPublicationAllowed(
        { ...replacing, versions: ["1.0"] },
        later,
        "1.0",
        queue("PASSED"),
      ),
    ).toThrow(/Not a 0.x.y test version/)
  })
})

describe("a milestone replaces its own build after the owner asked for changes", () => {
  const first = "a".repeat(40)
  const fixed = "c".repeat(40)
  const own = {
    milestone: "D4",
    versions: ["0.4.3"],
    sourceCommit: fixed,
    activeVersion: "0.4.2",
    ownerInstalled: null,
    replaces: {
      milestone: "D4",
      ownerCheck: "D4-PHONE-TRANSFER",
      activeVersion: "0.4.2",
      sourceCommit: first,
    },
  }
  const queue = (status) => ({ items: [{ id: "D4-PHONE-TRANSFER", status }] })

  it("publishes the fix once nobody is testing the old build", () => {
    for (const status of ["CHANGES_REQUESTED", "NEEDS_SETUP", "PASSED"])
      expect(() =>
        assertTestPublicationAllowed(own, fixed, "0.4.3", queue(status)),
      ).not.toThrow()
  })
  it("keeps the old build while its check is ready for the owner", () => {
    expect(() =>
      assertTestPublicationAllowed(own, fixed, "0.4.3", queue("READY")),
    ).toThrow(/stays until its owner check passes/)
  })
})
