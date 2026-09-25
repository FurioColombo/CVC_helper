# Owner-run physical-device validation

These checks require real hardware and must be performed by the owner. Do not
mark checks passed from a simulator or injected audio/photo fixture. Keep all
utterances anonymous and all scan rosters fictitious.

Use the same commit on every device in a milestone run. The PC can use
`http://127.0.0.1:4173/` in Chrome or Edge. Android Chrome and iPhone Safari need
a **trusted HTTPS** address for that build; plain LAN HTTP does not grant the
required camera/microphone access. Record the URL, commit, browser and OS version.

## V03 speech checks: required before V03 closes

Record the owner's results, one entry per physical target, in
`.evidence/V03/speech-device-evidence.json`. All three targets are required by
`03_TECHNICAL_DECISIONS.md` §5. Do not store the utterance or recognized text.

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

### Scan: Android and iPhone

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

UG2 remains open until the three speech targets and both phone scan targets have
real observations and the dedicated physical-device review has no blocker.
