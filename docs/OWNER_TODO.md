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

**State:** Passed from owner report · Required

**What to do:**

The owner reported: 1: on the PC the app briefly showed another page, closed and reopened by itself very quickly, then opened the course correctly with the correct version. 2: on the phone the update button showed after a couple of seconds and worked flawlessly. 3: a note changed on the phone was on the PC after reopening the screen, fast even on an immediate refresh; no automatic refresh, which is known. 4: the same from the PC to the phone. Nothing odd came up.

**Expected:** 0.5.3 updates in place on both devices and keeps the backup. The PC leaves the stuck restore and opens on your course. An edit on either device reaches the other after its screen is left and reopened. Only your actual observations can pass this check.

**Build:** `6e17c1d313eabf15f6afdded9c401b36fa5fabe8`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

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

**State:** Passed from owner report · Required

**What to do:**

The owner reported: Steps 1-5 passed on the phone: after Esci and Azzera tutti i dati locali, the restore from the backup online brought back the course; the students and the two notes checked were there. It was fast, never more than 2 seconds of waiting. After an edit, Copia online aggiornata came immediately. Step 6 (optional, a PC with another course asked before replacing) skipped by the owner.

**Expected:** An emptied phone restores the course in full from the backup and reopens on it; nothing can be created meanwhile; a device with another course asks before replacing it. Only your actual observations can pass this check.

**Build:** `3bdd415a0c061c6ba45e562bc7d5ec8238c3e519`

**Test address:** https://furiocolombo.github.io/CVC_helper_test/

**Guide:** [Device check guide](./DEVICE_CHECKS.md)

**Work affected:** The owner report is recorded.

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

**State:** Passed from owner report · Required

**What to do:**

The owner reported: The owner ran supabase/migrations/20261104000000_keep_course.sql in cvc-helper-dev. The live spec then found keep_course installed and passed on both browser projects (.evidence/B7/live-keep-rule.json).

**Expected:** The server can keep one of an account's courses in one step, erasing only what your phone showed, so two devices choosing together can never erase both. It adds and replaces functions and a trigger, and changes no data.

**Build:** No test build is assigned yet.

**Work affected:** The owner report is recorded.

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

<a id="wx1-network"></a>

## Let Vento fetch forecasts before sign-in — WX1

**State:** Passed from owner report · Required

**What to do:**

The owner reported: The owner accepts that Vento, once opened, asks Open-Meteo and LaMMA for forecasts before sign-in, also by itself while it stays open. Home still never connects. The rule is amended in the plan, 03 and DEPLOY.md when WX1 starts, with the code that needs it.

**Expected:** With a yes, the rule is amended in the plan, 03 and DEPLOY.md together, and WX1 starts after B7's handoff. With another answer, Vento's design changes before it starts.

**Build:** No test build is assigned yet.

**Work affected:** The owner report is recorded.

<a id="wx1-places"></a>

## Confirm the session hours and the forecast points — WX1

**State:** Ready for owner check · Required

**What to do:**

1. Derive: done on 2026-11-11 from your answer. Cala Fico is at 41.1859 N 9.4442 E, and the forecast points become Cala Fico 41.185 N 9.448 E, Isola del Porco 41.1757 N 9.4597 E and Punta Rossa 41.1712 N 9.4659 E, inside or at the edge of the areas you drew. Say so only if one is wrong.
2. Sessions are taken as morning 9 to 13 and afternoon 14 to 18. Tell me the real hours if they differ.
3. Cabinati points: Spargi 41.24 N 9.325 E, La Maddalena nord 41.265 N 9.41 E, Caprera est 41.215 N 9.5 E, Caprera sud 41.168 N 9.465 E, Liscia di Vacca 41.148 N 9.53 E, Cannigione 41.125 N 9.445 E. Tell me 'points right' or the corrections.
4. Optional: what the four colours of your drawing mean (course levels?), and where Cala Merda is when you remember.

**Expected:** The forecast is asked for where the boats actually sail, and each session is the part of the day you are on the water.

**Build:** No test build is assigned yet.

**Work affected:** Completion of WX1 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.

<a id="wx1-terms"></a>

## Tell LaMMA about the use, and check Open-Meteo's terms — WX1

**State:** Ready for owner check · Required

**What to do:**

1. LaMMA's disclaimer asks that information on the use of its products be sent to it. Write to info@lamma.toscana.it: CVC Helper, a tool for the Caprera sailing centre's instructors, shows LaMMA's Bocche di Bonifacio wind and wave maps unaltered, with credit and a link. You may also ask whether they could offer a point series or allow a browser to read their data for Caprera.
2. Open-Meteo's free service is for non-commercial use under 10,000 calls a day (https://open-meteo.com/en/terms). Decide whether the centre's use qualifies, and whether the Home line, which quotes their data, needs their credit too. If unsure, ask them.
3. Tell me what you sent and what you decided. I do not write to either on your behalf.

**Expected:** Both providers' terms are respected before Vento reaches anyone but you.

**Build:** No test build is assigned yet.

**Work affected:** Completion of WX1 and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.
