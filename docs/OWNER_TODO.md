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

**State:** Passed from owner report · Required

**What to do:**

The owner reported: Update 0.4.2 to 0.4.3 offered within about 5 seconds of starting the app; Impostazioni shows 0.4.3. Conservazione dei dati: the browser agreed to keep the app data even when space is low. Prepara then Salva file worked on the first tap. Condividi sent the course file to WhatsApp as a .txt file. Import of the shared or saved file: preview, cancel, then confirmed replacement worked; students, notes, duties and crews checked. Azzera tutti i dati locali finished on its own and the app reopened without a course (import and reset sections shown, which the owner questioned but accepted). Regular app: the owner did not open an installed regular CVC Helper app; opening the regular CVC Helper in Chrome, its data stayed separate from the test app.

**Expected:** The actual Android share/save/import round trip preserves the synthetic course. Storage permission is reported honestly, full reset completes without restoring erased data, and the regular app retains its course. No simulated or inferred device PASS.

**Build:** `7ac55d8210e9c08c36dd676e80bc018d2cd216b4`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

<a id="ug3-final-build"></a>

## Confirm the final 0.4.0 build on your regular app — UG3

**State:** Ready for owner check · Required

**What to do:**

1. A one-minute look at your real app: change nothing, and report no personal data.
2. Close the regular CVC Helper completely and open it again (if an update bar appears, tap Aggiorna).
3. Check that Impostazioni shows version 0.4.0 and that your course opens with its students as before.
4. Report UG3-FINAL-BUILD with what you saw.

Use the test address below and the linked device instructions.

**Expected:** The regular app runs the final 0.4.0 build with the course intact. Only actual phone observations pass.

**Build:** `ed83223c9a4b5455b736109f062b798ae5324262`

**Test address:** https://furiocolombo.github.io/CVC_helper/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of UG3 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="ug3-phone-release"></a>

## Check the 0.4.0 release build on Android — UG3

**State:** Passed from owner report · Optional

**What to do:**

The owner reported: The owner reports observing every step and all good: the update arriving without reinstalling with a typed note kept after Aggiorna, the controls reachable at enlarged text (also seen on the earlier 0.4.2 update), export, share and import, and Conservazione dei dati. Individual values (offer time, version shown) were not restated. Exception, not blocking by the owner's judgement: having CVC Helper Test and the regular app installed together is problematic; it worked once, then after problems and reinstalling the regular app, installing the test app says it is already installed although it is not visible (perhaps a failed uninstall or a conflict with the regular app; a phone reboot may fix it). Their data stayed separate.

**Expected:** The update arrives without reinstalling and keeps the typed note; controls stay reachable at enlarged text; export, share and import round-trip the synthetic course; storage persistence is reported honestly. Only actual phone observations pass.

**Build:** `c56ffe77c81427a25d237adf11995ae4c44092a9`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

<a id="ug3-regular-update"></a>

## Update your regular CVC Helper from 0.3.0 to 0.4.0 — UG3

**State:** Passed from owner report · Optional

**What to do:**

The owner reported: Owner: done and passed, no issue to signal. The installed regular app took 0.4.0 from 0.3.0 without reinstalling and the real course opened; no further detail (offer timing, counts, Conservazione answer, saved file) was given.

**Expected:** The installed 0.3.0 app takes 0.4.0 without reinstalling, the real course opens unchanged, Impostazioni shows 0.4.0 and the course can be saved to a file. Only actual phone observations pass.

**Build:** `92b0d94bbc7f5fa521e0a3f5c32a1a36f023c505`

**Test address:** https://furiocolombo.github.io/CVC_helper/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.
