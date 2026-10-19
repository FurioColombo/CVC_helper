# Owner-run device checks

These checks need real hardware and are performed by the owner. Never mark one
passed from a simulator or an injected audio or photo fixture. Use anonymous
utterances and fictitious rosters only.

## How a check run works

- [Owner todo](./OWNER_TODO.md) supplies the requests, readiness, exact build
  and address. AWAITING_OWNER and safe parallel agent work follow
  [the owner workflow](./OWNER_WORKFLOW.md). Tell the agent which item you ran
  and what happened; it records your report, never an inferred PASS.
- A release gate (and any milestone whose plan section asks for it) names the
  checks below that it needs. Use the same commit on every device of the run.
- Android Chrome and iPhone Safari need a **trusted HTTPS** address: the
  deployed GitHub Pages build (`docs/DEPLOY.md`), or a preview that is served
  over HTTPS. A PC can use `http://127.0.0.1:4173/` in Chrome or Edge.
- Record the URL, commit, device, browser and OS version and each result in
  `.evidence/<ID>/physical-device-review.json`. Never store a photograph, an
  utterance or recognised text.
- A check that was not run is listed as not run, with the reason; it is never
  recorded as passed.

## Speech

1. Open a student's note editor, type a short prefix, then tap **Detta**. The
   microphone permission is asked only after the tap.
2. On first use the model loads with progress, then recording starts. Speak one
   short Italian sentence and tap **Termina**: the text joins the note directly,
   with no separate accept step.
3. Correct the text, close and reopen the app: it persists. Repeat with an empty
   note.
4. Deny the permission and retry; cancel during loading, recording and
   processing. Typed text stays, retry works and the system microphone
   indicator turns off.
5. Dictate a fault description and an evaluation note in their panels; each
   saves. No audio appears in course data after reopening.

Record per device whether the utterance was substantially recovered, cold and
warm model load times, time from **Termina** to insertion, edit and persistence,
recovery behaviour, and PASS or FAIL.

## Roster scan

1. From **Scan allievi**, use **Fai una foto** and **Scegli da galleria**:
   native capture, full-screen camera, correct orientation, a usable preview;
   free rotation and crop before reading.
2. Review every row: correct a field, remove a false row, save only reviewed
   rows. Reload and find the corrected students. Retake an unreadable photo
   rather than accept guesses.
3. The photo and the crop are not kept as course data: inspect the site's
   storage, or repeat the flow after a reload and find no image.

Record the device and browser, the photo conditions, the expected and correctly
read person–field matches, the corrections, the orientation and crop outcome,
the save-and-reload result, the photo's disposal, the time from **Usa questa
area** to the review, and PASS or FAIL.

## Assistant paste

1. From **Scan allievi**, open **Oppure usa un assistente**, copy the
   instructions, and send a photo of a fictitious or public roster to the
   assistant the centre authorises.
2. Paste the answer back: every row shows an age, never a birth date; an
   unread line is fixed or left out; **Sono tutti** confirms the count before
   saving. Note the assistant and how many lines were unread.

## Installed app

1. Install the app on the home screen. In airplane mode, cold open it: Home, a
   student edit, a crew change and a scan work offline.
2. Offline, the first dictation after an update says a connection is needed
   once and keeps the typed text; online it downloads once, then works
   offline.
3. Phone Back in every area (Allievi, Barche, Avarie, Comandate, Equipaggi,
   Valutazioni, Volontari, Impostazioni) returns to the previous screen of the
   area and never drops an unsaved edit, an open note or a failed save
   silently.
4. **Nuova versione disponibile**: **Più tardi** hides it; **Aggiorna** asks
   before leaving unsaved work.
5. The home-screen icon, and a launch colour that matches the app background.
6. Only on a device you can reset: **Impostazioni → Elimina il corso e inizia un
   nuovo corso** asks for confirmation and opens course creation.

## Updates and versions

From 0.4.0 (D3). The check needs two deployments of the same commit's line to
one HTTPS address: version N installed first, then N+1 published while N is
open (`docs/DEPLOY.md`). N+1 differs from N in the patch only (as
`npm run check:update` does): the data keeps the newest version that opened it
for good, so a later minor version would leave the phone's course read-only
for the real release. N is itself 0.4.x: an update from 0.3.0 says nothing
after it, since 0.3.0 kept no record of its version.

1. Install N on the home screen. **Impostazioni** shows its **Versione**.
2. With the app open on Home, publish N+1. Switch to another app or lock the
   phone for a minute, then come back: within a minute **Nuova versione
   disponibile** appears, with no reinstall and no reload by hand. A tap on
   the bar in the moment it appears does nothing.
3. Open a student's edit, type a change, and immediately tap **Aggiorna**, even
   if **Salvataggio…** is still shown: the change is
   kept, the app reopens, the bar says once **CVC Helper è aggiornata alla
   versione …**, and **Impostazioni** shows the new version.
4. While the offer is shown, it covers neither the **+** of Allievi nor the
   floating bar of Equipaggi, also with a person selected in Equipaggi and
   with the phone's text size raised.
5. **Impostazioni → Cerca aggiornamenti**: in airplane mode it says the phone
   is offline; online, with nothing new, **Nessuna versione più recente
   disponibile ora.**

Record the URL, both versions, the time from the return to the offer, whether
**Salvataggio…** or **Salvato** was shown when you tapped, and whether the change
survived.

## Course files and full local reset

Run this only when `D4-PHONE-TRANSFER` is READY in [Owner todo](./OWNER_TODO.md).
The agent supplies the build through the permanent CVC Helper Test installation
after D3's update check; keep that installation and use fictitious people only.

1. In Impostazioni, read Conservazione dei dati and report whether the browser
   agreed. Refusal is a supported result; the app must explain it honestly.
2. Prepare the course file. Save it and use Condividi to send it to another app
   (the shared copy is the same course as a .txt file, which Android accepts).
   Check that the file is available there and its name has no person's name.
3. Choose that saved file for import. Check the preview, cancel once, then
   explicitly confirm replacement. Reopen the course and check its students,
   notes, duties and crews; close and reopen the app again.
4. With synthetic data only, use Azzera tutti i dati locali. Check that it asks
   for confirmation, finishes, and opens without a course afterwards. Check
   the regular CVC Helper app still has its own course.
5. Report the item ID, build, address, device/browser/OS, what the receiving app
   did, and every observed result. Actual sharing and device behaviour remain
   pending until this owner report; browser simulation cannot pass them.

## Summaries

1. In the crew summary (**Apri vista lettura**) and the Comandate summary, tap
   **Copia immagine** and paste in WhatsApp: the image matches the screen, with
   every crew or day and names inside their cards, except that it leaves out the
   screen's "Tutti gli allievi assegnati" note (`01_PRODUCT_SPEC.md` §7.5).
2. **Condividi** opens the share sheet with the image.

## Not yet run on any device

As of 0.3.0 (`.evidence/UG2/physical-device-review.json`):

- every check on an iPhone;
- on Android, **Condividi** on the summaries (only copying and pasting was
  reported), **Scegli da galleria** and the check that the photo and crop are
  not kept (only the camera scan was reported);
- the speech checks 1–5 on any device: the owner accepted speech as it is
  after using it on Android and a PC, without running the detailed steps;
- the home-screen icon and launch colour, the scan time, the first offline
  dictation message and erasing the course.

They wait until the owner asks; none of them is a PASS.
