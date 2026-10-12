# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="d3-phone-update"></a>

## Choose the setup for D3’s Android update check — D3

**State:** Setup needed · Required

**What to do:**

1. Choose USB/adb reverse on a PC, provide an HTTPS preview, or explicitly authorize two pre-release deployments to main.
2. The phone check becomes READY after D3 fixes, reviews, CI and final verification pass and the test address is prepared.
3. When the build is READY, follow docs/DEVICE_CHECKS.md under Updates and versions.

No phone-test build is ready. Setup can be chosen now; wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Choosing setup does not mark that work verified.

**Expected:** The update offer appears within one minute without reinstalling, an unsaved edit survives the update, and the controls remain reachable.

**Build:** No test build is assigned yet.

**Guide:** [Updates and versions](./DEVICE_CHECKS.md#updates-and-versions)

**Work affected:** Completion of D3 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
