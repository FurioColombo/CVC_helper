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

**State:** Owner requested changes · Required

**What to do:**

The owner reported: Update 0.4.1 to 0.4.2 worked; a student note typed before the update was kept. Conservazione dei dati said the browser does not guarantee keeping data when space is low and to export regularly. Export: the button needed two taps before anything visible happened (possibly working silently), then it worked and offered to download the file again. Condividi failed with Condivisione non riuscita; the error text is hard to notice (no icon, colour or emphasis). The owner asks to remove the Chiudi il file pronto button. Import preview, cancel, replacement and reopen showed no issue. PROBLEM: Azzera tutti i dati locali took very long or got stuck; after closing and reopening, the app stayed on Apertura del corso… then showed Non riesco ad aprire i dati locali, and Riprova did not fix it; only uninstalling and reinstalling the app recovered it. After reinstalling, importing the saved file worked. Not reported: whether the regular CVC Helper app kept its course. Owner question: importing a different course should replace the current one or say it is not compatible. Agent fixes are needed before this check can be ready again.

**Expected:** The actual Android share/save/import round trip preserves the synthetic course. Storage permission is reported honestly, full reset completes without restoring erased data, and the regular app retains its course. No simulated or inferred device PASS.

**Build:** `fde1fe14787333536fb250ef2357793be3870be8`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of D4 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions. Work depending on the reported problem pauses for fixes.

**Latest owner report:** Update 0.4.1 to 0.4.2 worked; a student note typed before the update was kept. Conservazione dei dati said the browser does not guarantee keeping data when space is low and to export regularly. Export: the button needed two taps before anything visible happened (possibly working silently), then it worked and offered to download the file again. Condividi failed with Condivisione non riuscita; the error text is hard to notice (no icon, colour or emphasis). The owner asks to remove the Chiudi il file pronto button. Import preview, cancel, replacement and reopen showed no issue. PROBLEM: Azzera tutti i dati locali took very long or got stuck; after closing and reopening, the app stayed on Apertura del corso… then showed Non riesco ad aprire i dati locali, and Riprova did not fix it; only uninstalling and reinstalling the app recovered it. After reinstalling, importing the saved file worked. Not reported: whether the regular CVC Helper app kept its course. Owner question: importing a different course should replace the current one or say it is not compatible.
