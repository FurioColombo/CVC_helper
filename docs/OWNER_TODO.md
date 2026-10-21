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

<a id="ug3-phone-release"></a>

## Check the 0.4.0 release build on Android — UG3

**State:** Setup needed · Required

**What to do:**

1. This check is not ready yet. The agent publishes the final 0.4.0 source to CVC Helper Test as 0.4.4 after the release reviews and the final verification pass, and tells you when it is ready.
2. Once READY, keep your installed CVC Helper Test and use fictitious people only. Before switching away, open a student and type a note but do not leave the screen. Switch away and back until Nuova versione disponibile appears, then tap Aggiorna at once: the typed note must survive, and Impostazioni must show 0.4.4.
3. With the phone text size raised, check that the update offer covers neither the + of Allievi nor the Equipaggi controls with a person selected.
4. Export the course (Salva file and Condividi), import it back after the preview and confirmation, and read Conservazione dei dati.
5. Report UG3-PHONE-RELEASE with your device, browser and Android version and what you saw.

No phone-test build is ready. Wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Preparing setup does not mark that work verified.

**Expected:** The update arrives without reinstalling and keeps the typed note; controls stay reachable at enlarged text; export, share and import round-trip the synthetic course; storage persistence is reported honestly. Only actual phone observations pass.

**Build:** No test build is assigned yet.

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of UG3 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
