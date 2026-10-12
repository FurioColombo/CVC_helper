import assert from "node:assert/strict"

/** The installed phone build stays fixed until explicit owner coordination. */
export function assertTestPublicationAllowed(pin, source, version) {
  assert.equal(pin.milestone, "D3")
  assert(/^[a-f\d]{40}$/.test(source), "Source must be a full commit SHA")
  assert.equal(pin.firstVersion, "0.4.0")
  assert.equal(pin.secondVersion, "0.4.1")
  assert(
    [pin.firstVersion, pin.secondVersion].includes(version),
    "Use one of the two pinned patch versions",
  )
  if (pin.sourceCommit)
    assert.equal(
      source,
      pin.sourceCommit,
      "Owner testing is pinned: later work cannot replace this source",
    )
  if (version === pin.secondVersion) {
    assert.equal(
      pin.activeVersion,
      pin.firstVersion,
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
  } else {
    assert(
      !pin.activeVersion || pin.activeVersion === version,
      "Do not downgrade the active owner build",
    )
  }
}
