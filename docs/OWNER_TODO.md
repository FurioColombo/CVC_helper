# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="d3-phone-update"></a>

## Install CVC Helper Test and check Android updates — D3

**State:** Passed from owner report · Required

**What to do:**

The owner reported: Accepted by the owner with two steps not observed. Observed on the phone: 0.4.0 installed from the test address and kept, no reinstall; after other use, Nuova versione disponibile with Più tardi and Aggiorna appeared within a few seconds of returning (not timed precisely); after Aggiorna the bar said once CVC Helper è aggiornata alla versione 0.4.1, Impostazioni Versione shows 0.4.1, and previously registered students remained. Cerca aggiornamenti said offline in airplane mode and Nessuna versione più recente disponibile ora online. NOT OBSERVED: typing a student-note change and tapping Aggiorna immediately (Salvataggio…/Salvato state and survival of that edit); reachability of Allievi + and Equipaggi controls with enlarged text while the offer showed (owner did not check; said it looked ok).

**Expected:** The 0.4.0 → 0.4.1 update appears within one minute of returning, without reinstalling; the typed edit survives and controls remain reachable. Only your actual phone observations can pass this check.

**Build:** `761530f820908db8355e1bcdd661bc8c6f495385`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Updates and versions](./DEVICE_CHECKS.md#updates-and-versions)

**Work affected:** The owner report is recorded.

<a id="d4-phone-transfer"></a>

## Check course files, persistent storage and full reset on Android — D4

**State:** Setup needed · Required

**What to do:**

1. Open your installed CVC Helper Test (do not reinstall). Switch away and return until Nuova versione disponibile appears, tap Aggiorna, and check Impostazioni shows 0.4.2. Use fictitious people only.
2. In Impostazioni read Conservazione dei dati and note whether the browser agreed to keep the data. Prepare the course file, save it and share it to another app. Check it is available there and its filename contains no personal name.
3. Import that saved file: check the course preview, cancel once, then explicitly confirm replacement. Reopen the course and check students, notes, duties and crews; close and reopen the app again.
4. Confirm Azzera tutti i dati locali and check the app reopens without a course. Confirm the regular CVC Helper app still has its own course. Follow Course files and full local reset in docs/DEVICE_CHECKS.md.
5. Report D4-PHONE-TRANSFER with your device, browser and Android version and what you actually observed, including the receiving app and the persistent-storage answer.

No phone-test build is ready. Wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Preparing setup does not mark that work verified.

**Expected:** The actual Android share/save/import round trip preserves the synthetic course. Storage permission is reported honestly, full reset completes without restoring erased data, and the regular app retains its course. No simulated or inferred device PASS.

**Build:** No test build is assigned yet.

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of D4 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
