# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="d3-phone-update"></a>

## Check Android updates from GitHub HTTPS — D3

**State:** Setup needed · Required

**What to do:**

1. GitHub HTTPS is the chosen setup. Agents prepare a separate, verified test site; you need no USB connection or local server.
2. Wait for READY and the supplied test link. Install CVC Helper Test once on the Android home screen and use synthetic course data.
3. Keep that test app installed. Agents publish the next patch of the same verified source at the same address while the first version is open.
4. Follow docs/DEVICE_CHECKS.md under Updates and versions and report what happened.

No phone-test build is ready. Wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Preparing setup does not mark that work verified.

**Expected:** The update offer appears within one minute without reinstalling, an unsaved edit survives the update, and the controls remain reachable.

**Build:** No test build is assigned yet.

**Guide:** [Updates and versions](./DEVICE_CHECKS.md#updates-and-versions)

**Work affected:** Completion of D3 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
