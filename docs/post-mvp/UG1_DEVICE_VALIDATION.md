# UG1 physical-device validation

This is the remaining human-operated release check. Record the observed result in
`.evidence/U03/speech-device-evidence.json` and
`.evidence/U04/ocr-quality-evidence.json`; the UG1 reviewer must inspect both.
Do not mark the checks passed from a simulator or injected audio/photo fixture.

Use the same 0.2.0 release-candidate commit on every device. The PC can use
`http://127.0.0.1:4173/` in Chrome or Edge. Android Chrome and iPhone Safari need
a **trusted HTTPS** address for that build; plain LAN HTTP does not grant the
required camera/microphone access. Record the URL, commit, browser and OS version.
Use an anonymous test course and roster; do not put real student data in evidence.

## Speech: PC, Android and iPhone

1. Open a student's note editor. Type a short prefix, then tap **Dettatura**.
   Confirm permission is requested only after the tap.
2. On cold first use, observe asset loading/progress, then recording. Speak one
   short Italian sentence. Tap **Termina** and review the editable transcript.
3. Correct it, tap **Usa testo**, close and reopen the app. Confirm the final text
   persists. Repeat once with **Scarta**; the earlier typed text must remain.
4. Deny permission and retry. Cancel during recording or processing; text remains,
   retry is possible, and the operating-system microphone indicator turns off.
5. Also dictate a short fault description and evaluation note in their in-place
   panels. No audio file should appear in course data after reopen.

For each device record the expected phrase, observed transcript, recognition
errors, cold and warm load times, recording-to-review time, recovery behavior and
overall PASS/FAIL. There is no fixed speed or accuracy threshold; the result must
be editable and recoverable.

## Scan: Android and iPhone

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

UG1 remains open until all three speech targets and both phone scan targets have
real observations and the dedicated physical-device review has no blocker.
