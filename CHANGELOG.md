# Changelog

## 0.2.0 — 2026-09-21

Scanning a roster and dictating a note both existed in 0.1.0. What follows is
what changed.

- **Scanning a printed roster became trustworthy.** The reading is now recovered
  column by column from the word positions, so the age column and the staff block
  no longer arrive as students — one supplied sheet went from 26 candidates to
  exactly its 20 students. A word read with low confidence is kept and marked for
  attention instead of being blanked, which is what left rows half empty before.
  The sheet's name order is an explicit choice, per row or for the whole sheet:
  the app never assumes the first word is a given name. The photograph is
  straightened and cropped in a full-frame editor with zoom, panning, quarter
  turns, an exact angle and a line you draw along a rule, in place of the old
  rotation slider. Every row still goes through a review you have to complete
  before anything is added, and the photograph is never kept as course data.
- **Dictation became accurate enough to use, and reaches every note.** The model
  moved to Whisper base with generation brakes that stopped it collapsing into
  repetition — a six-word note used to come back as 444 words. Measured over a
  labelled Italian corpus, aggregate word error fell from 303% to 55%. It is
  still not perfect. The initial note, the course note, a fault description and an
  evaluation note all now record, transcribe and hand back editable text in the
  same panel, with honest permission, download, recording and processing states, a
  real cancel and a real retry; typed text survives a denial or a failure.
  Your voice is transcribed on the device and the audio is discarded afterwards —
  no recording and no text is ever transmitted. The model itself is downloaded
  once, about 73 MB from the Hugging Face CDN the first time anyone dictates, and
  runs from cache after that. Dictation also simply failed on PC Chrome for a
  while, because of a broken runtime version; that is fixed and guarded.
- **The whole interface was rebuilt for a phone held outdoors in a hurry.** Six
  Home cards and a three-item bottom bar; a course identity that reads
  `D2 - 35 | 2026` from the real course; a two-column student list whose card
  dropped from 84 px to 56 px, a volunteer row from 72 px, a boat card from 72 px
  to 54 px, so seven boats now fit where five did. Boat cards carry the maker's
  mark, the number and a state you can read down one column. Crew, duty and
  evaluation screens were compacted to keep one decision's information together.
  Colours come from the CVC mark, and every state carries a symbol or a word as
  well as a colour. Every page was checked for sideways scrolling down to a
  320 px screen at 200% text.
- **Students gained a second note, a safe delete and a shortcut.** A course/week
  note now sits beside the initial one and stays distinct from it. A student who
  appears anywhere in the week's history can no longer be deleted: the app lists
  the exact references that block it and offers to disable them instead, keeping
  the history intact. Deleting a student who was never used is atomic and
  confirmed. Double-click, or long-press on touch, on any field in a profile opens
  the edit form with that field already focused; `Modifica` still does the same
  thing the plain way.
- **Boats and volunteers.** A whole fleet goes in one field: numbers separated by
  commas, spaces, newlines or semicolons, with repeated separators ignored and
  duplicates collapsed. Volunteers can be CT as well as ADV and IS, and embark
  like the others while staying out of every student count, duty and evaluation.
- **Duties, crews and evaluations gained the corrections asked for in the field.**
  The duty proposal spreads `floor(N/D)` and asks which days take the remainder; a
  day opens straight from the week; the number of crews can still be changed after
  a session is set up; an evaluation row shows the note itself, and a second tap
  clears a value.

### Migration

A 0.1.0 archive opens unchanged. All records, references, notes and history are
preserved, and the identifiers stay stable, so a course started before this
release keeps working. No account, server, synchronisation or second editor is
part of this release.

### Known limitation

**Neither dictation nor scanning has been tried on a real phone.** Dictation is
verified by a measured benchmark over a labelled Italian corpus; scanning is
verified against a synthetic corpus with known values, plus a hand-run check on
two real photographs. Both are verified by browser journeys across three device
profiles. None of that is a phone.

The phone checks need a trusted HTTPS address, because a browser will not give a
web page the camera or the microphone over plain HTTP, and the app has no such
address yet. Providing one is the first piece of work in 0.3.0, and the checks
run there, on real devices. The PC microphone check could have run over localhost
and simply was not; it moves with the others. Nothing in this release records a
device observation that was not made.

After an evaluation fails to save, the attempted value stays visible and can be
retried, but leaving that session before retrying discards the attempt.
