# Owner todo

This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.

Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).

<a id="b2-backend-setup"></a>

## Create the 0.5.0 development backend projects — B2

**State:** Passed from owner report · Required

**What to do:**

The owner reported: The owner created the Supabase development project cvc-helper-dev (West EU), ran the course-backup migration (13 tables with row-level security), created powersync_role, created the PowerSync Cloud project CVC Helper with a CLI token, and two synthetic test accounts; all values are in the ignored .env. Chose email magic-link sign-in. The agent verified each value's shape without printing it, linked and deployed the Development instance (EU), and confirmed replication of all 13 tables and both test sign-ins.

**Expected:** Development projects only, in the EU, with synthetic data; credentials stay in .env. The agent then links, deploys and checks the instance before any app code connects.

**Build:** No test build is assigned yet.

**Work affected:** The owner report is recorded.

<a id="b3-phone-signin"></a>

## Sign in to the online backup on Android and use it offline — B3

**State:** Passed from owner report · Required

**What to do:**

The owner reported: Passed with steps not observed. Observed on the phone: the emailed sign-in link opened CVC Helper Test from the mail app (not the installed app nor the browser) and signed in; Copia online aggiornata appeared almost at once; notes and students added, closing and reopening kept them. Airplane mode: 'Tutto inviato. Ora senza connessione.', then after a note 'In attesa di connessione: 2 modifiche da inviare' (still 2 after adding a student), and with signal back the count went 3, 2, 1 to 'Copia online aggiornata' without reopening; closing and reopening worked as expected. The Esci question about unsent changes appeared as expected and the course remained on the phone. Signing in from the mail link and from Chrome showed no difference. Sign-in is fast. NOT OBSERVED: typing a student during the one reload after sign-in (the owner reports sign-in is fast); the installed CVC Helper Test app (the owner used Chrome because the test app cannot be installed beside the regular one, BACKLOG).

**Expected:** Sign-in by the link (or the code) works on the phone and the backup reaches 'Copia online aggiornata'; offline the account stays signed in and the backup resumes with signal; nothing typed is lost around the one reload; Esci warns about unsent changes and keeps the course. Only your actual phone observations can pass this check.

**Build:** `b8de760f1c7f8e398b8abcf58818ad8c3a8822c1`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

<a id="b4-phone-uploads"></a>

## Install the B4 build, switch on the server rules, and use the backup offline for a day — B4

**State:** Ready for owner check · Required

**What to do:**

1. Open CVC Helper Test in Chrome as before (do not reinstall). Switch away and back until Nuova versione disponibile appears, tap Aggiorna, and check Impostazioni shows 0.5.1 and still Accesso: &lt;your email&gt; with Copia online aggiornata. Use invented people only.
2. Only after that: in the Supabase dashboard of cvc-helper-dev open SQL Editor, paste the whole file supabase/migrations/20261026000000_upload_rules.sql and run it once (it should report success with no rows). Tell me 'rules run' in the chat: I then run the live checks of the two server rules against the backend.
3. Back in the app, add a student and change a note: Impostazioni should return to Copia online aggiornata within a few seconds (the new rules accept 0.5.1).
4. Then a day of ordinary use offline: turn on airplane mode, make many edits over the day (students, notes, crews, duties, evaluations). Note whether saving ever feels slower than usual, and roughly how many changes Impostazioni says are waiting.
5. Turn airplane mode off: note how long it takes to reach Copia online aggiornata, and whether any 'Il backup ha rifiutato' message or a note about another phone appears (none is expected with one phone).
6. Report B4-PHONE-UPLOADS with your device and what you saw at each step.

Use the test address below and the linked device instructions.

**Expected:** 0.5.1 updates in place and keeps the backup; after the migration the app's writes are accepted; a day of offline edits saves without noticeable slowdown and uploads in full when signal returns, with no refusal. Only your actual phone observations can pass this check.

**Build:** `5e09c8f4c097393475f6d9a2fbdabcc506bb2983`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B4 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

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

**State:** Passed from owner report · Required

**What to do:**

The owner reported: Closed and reopened the regular CVC Helper; Impostazioni shows 0.4.0 and the course opened with its students as before.

**Expected:** The regular app runs the final 0.4.0 build with the course intact. Only actual phone observations pass.

**Build:** `ed83223c9a4b5455b736109f062b798ae5324262`

**Test address:** https://furiocolombo.github.io/CVC_helper/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

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

<a id="b3-email-code"></a>

## Add the sign-in code to the backend email, with a custom email sender — UG4

**State:** Setup needed · Optional

**What to do:**

1. Not possible yet: Supabase lets you edit the email only after you set up your own email sender (Authentication &gt; Emails &gt; Set up SMTP). With its built-in sender the email carries just the link.
2. Nothing to do for the Android check: on Android the link opens in Chrome, which shares the installed app's storage.
3. Before production (UG4) a custom sender is needed anyway (the built-in one only delivers to your Supabase team and a few emails an hour); add &lt;p&gt;Codice: {{ .Token }}&lt;/p&gt; to the Magic link template then. Report B3-EMAIL-CODE with "code added" if you do it earlier.

**Expected:** Each sign-in email carries both the link and a numeric code, so Impostazioni can sign in where the link opens in another browser (an iPhone home-screen app). Deferred until a custom email sender exists.

**Build:** No test build is assigned yet.

**Work affected:** No required milestone completion is blocked.
