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
