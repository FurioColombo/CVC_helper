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

## Update to 0.5.3: the PC finishes its restore and follows the phone — B4

**State:** Ready for owner check · Required

**What to do:**

1. Your offline-day steps already passed on 0.5.2. This recheck covers the PC and takes a few minutes.
2. On the PC, close every tab of the test address and open it again. If Nuova versione disponibile appears, tap Aggiorna. The stuck restore should finish by itself and the app should open on your course, with Versione 0.5.3 in Impostazioni. If it is still stuck after a minute, stop and report that.
3. On the phone, in Chrome (do not reinstall), switch away and back until Nuova versione disponibile appears, tap Aggiorna, and check Impostazioni shows Versione 0.5.3 and Copia online aggiornata.
4. Change a note on the phone. On the PC, leave that screen and open it again: the change should be there. An open screen does not refresh by itself.
5. Change a note on the PC and check the same on the phone.
6. Do not use Azzera tutti i dati locali or Elimina il corso while signed in: they also erase the online copy (that is checked later, in B6-PHONE-ERASE). Do not create a course on a second device while the first is offline or already has one: until B7 that locks every device of the account.
7. Report B4-PHONE-UPLOADS with what you saw at each step.

Use the test address below and the linked device instructions.

**Expected:** 0.5.3 updates in place on both devices and keeps the backup. The PC leaves the stuck restore and opens on your course. An edit on either device reaches the other after its screen is left and reopened. Only your actual observations can pass this check.

**Build:** `6e17c1d313eabf15f6afdded9c401b36fa5fabe8`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B4 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="b5-minimum-read"></a>

## Let the app read the server's minimum app version — B5

**State:** Passed from owner report · Required

**What to do:**

The owner reported: The owner ran the migration once in cvc-helper-dev. Resuming the milestone to reverify it on the current source reset this item, but the migration stays in the database. Nothing to run again.

**Expected:** A signed-in account can read the minimum writer version and nothing else; a restored course adopts it, so an app older than it opens the course read-only.

**Build:** No test build is assigned yet.

**Work affected:** The owner report is recorded.

<a id="b5-phone-restore"></a>

## Restore your course on an emptied phone, and see the question for another course — B5

**State:** Ready for owner check · Required

**What to do:**

1. After B4-PHONE-UPLOADS: the phone is on 0.5.3 with Copia online aggiornata. Note how many students and notes your invented course has.
2. Impostazioni &gt; Backup online &gt; Esci first (from 0.5.3 a reset made while signed in also erases the online copy). The course stays on the phone.
3. Then Impostazioni &gt; Azzera tutti i dati locali, and confirm. The app reopens empty, on Crea il corso.
4. On that screen, under Ripristina dal backup online, type your email and send the link; open it from the mail as before. Note what the screen says while it downloads (it should say Ripristino del corso… and keep Crea corso disabled), and how long until the app reopens on your course.
5. Check the restored course: the same students, notes, crews and evaluations as before; then edit something and see Copia online aggiornata.
6. Optional, on the PC: Impostazioni &gt; Backup online &gt; Esci, then Azzera tutti i dati locali. Create a different invented course there, then in its Impostazioni sign in with the same email. It should ask, naming your online course, before replacing anything; tap Annulla ed esci and check the PC course stays.
7. Report B5-PHONE-RESTORE with what you saw at each step, and which you skipped.

Use the test address below and the linked device instructions.

**Expected:** An emptied phone restores the course in full from the backup and reopens on it; nothing can be created meanwhile; a device with another course asks before replacing it. Only your actual observations can pass this check.

**Build:** `3bdd415a0c061c6ba45e562bc7d5ec8238c3e519`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B5 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="b6-erase-rules"></a>

## Let the server keep an erased course erased — B6

**State:** Passed from owner report · Required

**What to do:**

The owner reported: The owner ran the migration once in cvc-helper-dev. Resuming the milestone to reverify it on the current source reset this item, but the migration stays in the database. Nothing to run again.

**Expected:** The server records the ids of erased courses (no course data, readable only by their owner) and refuses that course from any phone afterwards.

**Build:** No test build is assigned yet.

**Work affected:** The owner report is recorded.

<a id="b6-phone-erase"></a>

## Erase your course on the phone, once offline, and see it gone from the backup — B6

**State:** Ready for owner check · Required

**What to do:**

1. Only after B4-PHONE-UPLOADS and B5-PHONE-RESTORE are reported: they need the course on the backup. Use invented data only. These steps erase your test course for good; save a course file first if you want to keep it.
2. Start with both devices signed in, on 0.5.3 and showing the same course. On the phone: Impostazioni, Elimina il corso e inizia un nuovo corso. Read the question: it should say the course also goes from the backup online, and state what the provider's backups keep and for how long. Tick Ho capito and tap Elimina tutto.
3. The phone reopens on Crea il corso. On the PC, reload the test address: the erased course should be gone and it should wait for the account's course, not show the old one.
4. On the phone, create a different invented course with one student. Wait for Copia online aggiornata. Reload the PC: it should download and open this new course.
5. Now put the phone in airplane mode. Impostazioni, Elimina il corso e inizia un nuovo corso: this time the question should say appena c'è connessione. Confirm. The phone reopens on Crea il corso without signal.
6. Before reconnecting, reload the PC: the course is still there, because the phone has not been able to tell the backup yet.
7. Turn airplane mode off and keep the app open on the phone for a minute. Reload the PC: the course should be gone. Reload it again a minute later: it should not come back.
8. Optional: on the phone, create one more invented course, wait for Copia online aggiornata, then Impostazioni, Azzera tutti i dati locali. Its question should warn that the course also leaves the backup and that without signal nothing is reset. Confirm with signal and check the PC loses it too.
9. Report B6-PHONE-ERASE with what you saw at each step, and which you skipped.

Use the test address below and the linked device instructions.

**Expected:** Erasing the course on the phone erases it from the backup, also when the erase was made offline and the phone reconnected later; the erased course never comes back. Only your actual observations can pass this check.

**Build:** `3bdd415a0c061c6ba45e562bc7d5ec8238c3e519`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B6 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="b7-keep-rule"></a>

## Let the server keep the one course you choose — B7

**State:** Ready for owner check · Required

**What to do:**

1. Only on the development project, cvc-helper-dev. If you ran an earlier version of this file, run this one too: it replaces it, and no build calls the earlier one.
2. Open https://github.com/FurioColombo/CVC_helper/blob/claude/0.5.0-prep/supabase/migrations/20261104000000_keep_course.sql and copy the whole file with the copy button.
3. In the Supabase dashboard, open cvc-helper-dev, then SQL Editor, then New query. Paste, and tap Run. It should say Success. No rows returned. Supabase may warn about destructive operations, because the file replaces an earlier function if there is one: confirm, it touches no data.
4. Tell me 'keep rule run' in this chat, or paste the error if there is one. I then run the live test against the development backend, with invented data.

**Expected:** The server can keep one of an account's courses in one step, erasing only what your phone showed, so two devices choosing together can never erase both. It adds and replaces functions and a trigger, and changes no data.

**Build:** No test build is assigned yet.

**Work affected:** Completion of B7 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="b7-phone-choice"></a>

## Reach two courses on one account, see both, and keep one — B7

**State:** Setup needed · Required

**What to do:**

1. Not yet: it needs B7-KEEP-RULE and the next test build. The address follows here when both are ready.
2. Use invented data only. These steps erase one test course for good. Start with the account holding no course: if it holds one, on the phone use Impostazioni, Elimina il corso e inizia un nuovo corso. Keep the app open on the phone and on the PC, both signed in to the same account and both on Crea il corso.
3. Put the phone in airplane mode. On the phone, create a course, Cabinato level 3, with one invented student.
4. On the PC, create a different course, Deriva level 2, with one invented student. Wait for Copia online aggiornata in Impostazioni.
5. Turn airplane mode off and keep the app open on the phone for up to two minutes. Both devices should reopen by themselves on Scegli il corso da tenere, with two cards showing code, counts, last change and the account's email. Neither should stop on an error. Say whether the sentence about typing that may be lost was clear.
6. On the phone, tap Salva file on either card: a file should start saving, and the page should name it and say it holds personal data.
7. Put the phone in airplane mode again: Tieni questo corso goes grey and the page says the choice needs a connection. Turn airplane mode off and wait for the buttons to return.
8. On the phone, tap Tieni questo corso on Cabinato 3. The page should ask to confirm, naming the course it will erase and what that course contains. Tick Ho capito and tap Elimina.
9. The phone should open Cabinato 3 with its student. On the PC, Deriva 2 should leave by itself and Cabinato 3 should open, with no second choice. Reload both after a minute: only that course, with its student.
10. Report B7-PHONE-CHOICE with what you saw at each step, and which you skipped.

No phone-test build is ready. Wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Preparing setup does not mark that work verified.

**Expected:** An account holding two courses never locks a device: you see both, can save either to a file, keep one, and every device then opens on that one with nothing of it lost. Only your actual observations can pass this check.

**Build:** No test build is assigned yet.

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** Completion of B7 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

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
