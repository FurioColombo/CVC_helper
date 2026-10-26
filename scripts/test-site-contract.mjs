import assert from "node:assert/strict"

const testVersion = /^0\.(\d+)\.(\d+)$/

/**
 * A test build's place in the order of builds: 0.4.x until 0.4.0's
 * release, the 0.5.x line from the 0.5.0 cycle (src/appChannel.ts).
 */
function patchOf(version) {
  const match = testVersion.exec(version)
  assert(match, `Not a 0.x.y test version: ${version}`)
  return Number(match[1]) * 1_000 + Number(match[2])
}

/**
 * The installed phone build stays fixed until explicit owner coordination.
 * A pin names one milestone's verified source and its planned patch versions.
 * A later version of the same pin needs the owner's installation report; a pin
 * that replaces an earlier milestone's build needs that build's owner PASS,
 * and one that replaces its own milestone's build needs no check in progress.
 */
export function assertTestPublicationAllowed(
  pin,
  source,
  version,
  ownerChecks,
) {
  assert(/^[a-f\d]{40}$/.test(source), "Source must be a full commit SHA")
  assert.equal(
    source,
    pin.sourceCommit,
    "Owner testing is pinned: later work cannot replace this source",
  )
  assert(
    Array.isArray(pin.versions) && pin.versions.includes(version),
    "Use one of the pinned patch versions",
  )
  // The live build is this pin's own, or exactly the one it declares it
  // replaces; anything else would swap a build under the owner's check
  // unnoticed (D4 security review SP-R4-1).
  if (pin.replaces) {
    assert(
      pin.versions.every(
        (planned) => patchOf(planned) > patchOf(pin.replaces.activeVersion),
      ),
      "The new build must update the installed one",
    )
    assert(
      pin.activeVersion === pin.replaces.activeVersion ||
        pin.versions.includes(pin.activeVersion),
      "The live build must be this pin's or the one it replaces",
    )
  } else if (pin.activeVersion) {
    assert(
      pin.versions.includes(pin.activeVersion),
      "Another build is live: declare the build this pin replaces",
    )
  }
  if (pin.activeVersion)
    assert(
      patchOf(version) >= patchOf(pin.activeVersion),
      "Do not downgrade the active owner build",
    )
  const index = pin.versions.indexOf(version)
  if (index > 0) {
    assert.equal(
      pin.activeVersion,
      pin.versions[index - 1],
      "Install the first deployment before the second",
    )
    assert.equal(
      pin.ownerInstalled?.reportedBy,
      "owner",
      "Second deployment requires the owner's explicit installation report",
    )
    assert(
      pin.ownerInstalled.source && pin.ownerInstalled.summary,
      "Record the owner's installation report source and summary",
    )
  } else if (pin.replaces && pin.activeVersion === pin.replaces.activeVersion) {
    // Nothing of this pin is live yet: the replaced build is still installed.
    const check = ownerChecks?.items?.find(
      (item) => item.id === pin.replaces.ownerCheck,
    )
    // A milestone may replace its own build once nobody is testing it: the
    // owner asked for changes, or the check was reset for a new build.
    // Another milestone's build stays until its check has passed.
    const free =
      pin.replaces.milestone === pin.milestone
        ? ["PASSED", "CHANGES_REQUESTED", "NEEDS_SETUP"]
        : ["PASSED"]
    assert(
      free.includes(check?.status),
      `The installed ${pin.replaces.milestone} build stays until its owner check passes`,
    )
  }
}
