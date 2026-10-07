# Owner-run physical-device validation

These checks require real hardware and must be performed by the owner. Do not
mark checks passed from a simulator or injected audio/photo fixture. Keep all
utterances anonymous and all scan rosters fictitious.

Use the same commit on every device in a milestone run. The PC can use
`http://127.0.0.1:4173/` in Chrome or Edge. Android Chrome and iPhone Safari need
a **trusted HTTPS** address for that build; plain LAN HTTP does not grant the
required camera/microphone access. Record the URL, commit, browser and OS version.

## V03 speech checks

Record the owner's results, one entry per physical target, in
`.evidence/V03/speech-device-evidence.json`. All three targets are required by
`03_TECHNICAL_DECISIONS.md` §5. Do not store the utterance or recognized text.
The owner accepted V03 on 2026-09-25 after Android and PC/Chrome use despite
slow, imperfect recognition. Apple/iPhone was unavailable and remains untested.
This exception closes V03 only; the unreported detailed checks below are not
marked PASS. Repeat the release-candidate checks at UG2.

1. Open a student's note editor. Type a short prefix, then tap **Detta**.
   Confirm permission is requested only after the tap.
2. On cold first use, observe model loading/progress, then recording. Speak one
   short Italian sentence and tap **Termina**. Confirm the transcript is appended
   directly to the editable note without a separate accept/discard step.
3. Correct the inserted text, close and reopen the app, and confirm it persists.
   Repeat with an empty note and confirm the transcript appears there too.
4. Deny permission and retry. Cancel during loading, recording or processing;
   typed text must remain, retry must be possible, and the operating-system
   microphone indicator must turn off.
5. Also dictate a short fault description and evaluation note in their in-place
   panels, edit the inserted text, and confirm each host saves it. No audio file
   should appear in course data after reopen.

For each device record whether the anonymous test utterance was substantially
recovered, cold and warm model load times, recording-to-insertion time,
edit/persistence and recovery behavior, and overall PASS/FAIL. Do not store the
phrase or transcript. The result must be editable and recoverable.

## UG2 release-candidate checks

Repeat speech against the exact UG2 release candidate and record it in
`.evidence/UG2/physical-device-review.json`. The V03 results do not replace this
release-candidate check.

### Scan: Android (iPhone deferred)

1. From **Scan allievi**, try **Fai una foto** and **Scegli da galleria**. Confirm
   native acquisition, full-screen camera, correct EXIF orientation and a usable
   preview. Rotate freely and crop before extraction.
2. Review every proposed row. Correct a field, remove a false row and commit only
   reviewed rows. Reload and verify the corrected students; reject/retake an
   unreadable image rather than accepting guessed data.
3. Inspect application storage or repeat the flow after reload to confirm the
   original photo and adjusted crop were not retained as course data.

Record device/browser version, photo conditions, expected and correct
person–field matches, corrections, orientation/crop outcome, commit/reload result,
source-photo disposal and PASS/FAIL. Keep photographs out of the repository.
Also note how long the scan takes from **Usa questa area** to the review: the
table-rule eraser added in S4 costs about 0.3–0.5 s on a desktop and about 2 s at
4× CPU throttling.

### Assistant path (V05): Android (iPhone deferred)

1. From **Scan allievi**, open **Oppure usa un assistente**, copy the
   instructions, and send a photo of a fictitious or already public roster to
   the assistant the sailing centre has authorised.
2. Paste the answer back. Confirm every row shows the age (never a birth
   date), pasted rows need no per-row check, an unread line must be fixed or
   left out, and the **Sono tutti** count is confirmed before saving. Note which assistant and how many lines were unread.

### Installed app: offline, Back, update and new course

1. Install the app on the home screen. Put the phone in airplane mode and cold
   open it: Home, a student edit, a crew change and a scan must work offline.
2. **Dictation after this update, offline:** the first dictation after
   installing this version downloads the speech model again. Offline it must
   say that a connection is needed the first time and keep the typed text;
   online it must download once and then work offline.
3. Use the phone's Back in every area (Allievi, Barche, Avarie, Comandate,
   Equipaggi, Valutazioni, Volontari, Impostazioni): it returns to the previous
   screen of the area and never leaves an unsaved edit, an open note or a
   failed evaluation save without saying so.
4. When **Nuova versione disponibile** appears, **Più tardi** hides it and
   **Aggiorna** asks before leaving unsaved work.
5. Check the home-screen icon and that the launch screen colour matches the
   app background.
6. Only on a device you can reset: **Impostazioni → Elimina il corso e inizia
   un nuovo corso** asks for confirmation and opens course creation.

### Summaries: Copia immagine and Condividi

1. Open the crew summary (**Apri vista lettura**) and the Comandate summary.
   Tap **Copia immagine**, open WhatsApp and paste: the image must match the
   screen, with every crew or day, names inside their cards and no
   "Tutti gli allievi assegnati" note.
2. Tap **Condividi** in the note and check the share sheet offers the image.

**Outcome at UG2 (2026-10-06/07).** The owner ran the checks on their Android
phone and released 0.3.0. They had no iPhone: every iPhone check, and the
items not observed (the icon and launch colour, the scan time, the first
offline dictation message, erasing the course), are listed in
`.evidence/UG2/physical-device-review.json` and wait in future work until the
owner asks for them.
