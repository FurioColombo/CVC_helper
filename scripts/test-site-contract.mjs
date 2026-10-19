import assert from "node:assert/strict"

const patchVersion = /^0\.4\.(\d+)$/

function patchOf(version) {
  const match = patchVersion.exec(version)
  assert(match, `Not a 0.4 patch version: ${version}`)
  return Number(match[1])
}

/**
 * The installed phone build stays fixed until explicit owner coordination.
 * A pin names one milestone's verified source and its planned patch versions.
 * A later version of the same pin needs the owner's installation report; a pin
 * that replaces an earlier milestone's build needs that build's owner PASS.
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
    assert.equal(
      check?.status,
      "PASSED",
      `The installed ${pin.replaces.milestone} build stays until its owner check passes`,
    )
    assert(
      patchOf(version) > patchOf(pin.replaces.activeVersion),
      "The new build must update the installed one",
    )
  }
}
