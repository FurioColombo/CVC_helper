# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="d3-phone-update"></a>

## Install CVC Helper Test and check Android updates — D3

**State:** Ready for owner check · Required

**What to do:**

1. Open the supplied link in Android Chrome and install CVC Helper Test once. Check Impostazioni shows 0.4.0. Create a synthetic course and fictitious student.
2. Reply “D3-PHONE-UPDATE: installed 0.4.0” with your device, browser and Android version. Keep this installation. The agent then publishes 0.4.1 from the same verified source at this same address and tells you when it is ready.
3. After that notice, switch away from the test app, return and time the update offer. Type a student-note change and immediately tap Aggiorna; note whether Salvataggio… or Salvato was shown. Check the edit survives and Impostazioni shows 0.4.1. Do not reinstall.
4. With enlarged text, check Allievi + and the Equipaggi controls with a person selected. Try Cerca aggiornamenti in airplane mode. Report the link, versions, offer time, saved edit and reachable controls; follow Updates and versions in docs/DEVICE_CHECKS.md.

Use the test address below and the linked device instructions.

**Expected:** The 0.4.0 → 0.4.1 update appears within one minute of returning, without reinstalling; the typed edit survives and controls remain reachable. Only your actual phone observations can pass this check.

**Build:** `761530f820908db8355e1bcdd661bc8c6f495385`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Updates and versions](./DEVICE_CHECKS.md#updates-and-versions)

**Work affected:** Completion of D3 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
