# Changelog

## 0.4.0 — 2026-10-22

0.4.0 makes the course on the phone safe before anything goes online: it can
be saved to a file and brought back, the app knows which version wrote the
data, and an installed app takes each new version without reinstalling. No
server, account or synchronisation is part of it. What follows is what
changed since 0.3.0.

- **A copy of the course in your hands.** Impostazioni prepares one file with
  the whole course, after reminding that it holds the students' personal data;
  its name has no personal name. **Salva file** keeps it on the phone,
  **Condividi** sends it (as a `.txt` file, which Android accepts) to WhatsApp,
  Drive or mail. **Importa un corso** reads either file, checks it completely,
  shows which course it found and replaces the current one only after you
  confirm; a damaged, invalid or too-new file changes nothing. The replaced
  course leaves no readable trace in the phone's storage.
- **The browser is asked to keep the data.** Impostazioni says whether it
  agreed; when it has not, it advises exporting regularly.
- **Starting from nothing.** **Azzera tutti i dati locali** removes the course,
  the preferences and the offline files of the app from this browser. If the
  app is closed before it finishes, the next open completes it instead of
  getting stuck.
- **Updates arrive by themselves.** The installed app looks for a new version
  each time it returns to the foreground and every hour; the offer appears
  within seconds, waits for anything being typed to be saved, never covers a
  control, and after the update says which version is installed. Impostazioni
  shows the version and **Cerca aggiornamenti**. An older app that meets
  data written by a newer one opens it read-only and asks for the update.
- **Every record is ready for the online backup.** Each row now records when it
  was created and changed and which course it belongs to; the Comandate
  settings are stored item by item. Behaviour is unchanged.
- **A faster, steadier test harness.** Unnecessary browser tests were removed,
  the full suite runs only for checkpoints and releases, and the remaining
  suite runs without a flaky test.

### Migration

A course created by 0.1.0, 0.2.0 or 0.3.0 opens unchanged: every record,
reference, note and identifier is kept, and the missing dates and course
links are filled in once. An upgrade interrupted by closing the app is rolled
back whole and completed on the next open. From now on the data records the
newest version that wrote it, so an older copy of the app cannot overwrite it.

The test channel used for the owner's phone checks (CVC Helper Test, 0.4.0 to
0.4.4) is a separate app with its own data; its numbers are not releases.

### Known limitations

- **The update from an installed 0.3.0 app was not checked on a phone.** Every
  phone check ran on CVC Helper Test. The 0.3.0 app's own banner, which is not
  always prompt, brings 0.4.0; export the course right after updating.
  The owner then checked it once on their Android phone with a real course
  (2026-10-22): it updated without reinstalling.
- **CVC Helper Test and CVC Helper installed on one phone** keep their data
  apart, but installing both is unreliable: once, Chrome said the test app was
  installed when no icon remained. Only the owner’s phone checks use the test
  app.
- **No iPhone has been tried.** iPhone/Safari is covered by browser tests on the
  WebKit engine only.
- **One full reset on 0.4.2 left the test app unable to open** until it was
  reinstalled; 0.4.3 completes an interrupted reset and passed on the phone,
  but the original cause is not established.
- **An older app still open in another window** can save over an imported
  course, and one that creates a course after an abandoned reset loses it at
  the next open. Close other app windows before importing or resetting.
- **The browser suite takes about 41 minutes on one worker**, longer than in
  0.3.0, because 0.4.0 added its own data tests; parallel workers do not help on
  the development machine.
- Unchanged from 0.3.0: scanning needs a look at every row, dictation is slow
  and imprecise, the course dates come from the day it is created, D2–D5 crews
  stay at two people, and long names on crew cards are cut with "…".

## 0.3.0 — 2026-10-08

0.3.0 is the first version used on a real phone: the app is published over
HTTPS on GitHub Pages and installs on the home screen, so the camera, the
microphone and offline use work on the device. What follows is what changed
since 0.2.0.

- **Adding students is fast, and only the age is kept.** A printed roster is
  scanned with the camera or from the gallery; the table's ruled lines are
  erased before reading, the sheet's name order is detected, and telephone
  numbers are read only when asked for. On the five real sheets supplied, the
  rows needing a check fell by more than half, and none of the students on
  them was merged, lost or invented. When a photo is
  hard, any chat assistant can read it instead: the app gives the prompt,
  takes the pasted answer from a phone or a computer, shows every line it
  could not read, and makes no network call itself. Every mode — scan, paste
  and manual entry — stores the age on the first course day, never the date
  of birth. The empty Allievi page and the menu offer the same three ways in.
  The crop editor has four edge handles and a live tilt.
- **Crews are composed by tapping.** Tap a free seat and then anyone still
  available — a student or a volunteer — to seat them there; tap a person and
  then a crew or a destination (a boat, Mezzi, A terra) the other way round.
  Boats page with a swipe. A D1 or cabin course starts its crews at four
  people, and each crew card can be resized; Impostazioni chooses two or three
  names per row. A boat with an open fault, like an unavailable
  one, puts a warning on its crew; volunteers never count toward size or
  repeat warnings.
- **Summaries you can send.** The crew summary groups the crews by boat model
  under the class logos, in two columns, with the class colours and the
  centre's own gommone icon for the Mezzi; the students still to place come
  first. The Comandate get the same kind of summary. **Copia immagine** copies
  the summary as a picture of the screen, every crew included, ready to paste
  in WhatsApp; **Condividi** opens the phone's share sheet.
- **Moving around a phone.** The phone's Back button walks back through each
  area and, in most places, stops before an open note or an unsaved edit is
  lost. The
  app has its own icon and launch colour. A banner offers each new version.
  Students with the same first name are told apart by the shortest piece of
  surname that does it, keeping particles such as De or Lo with it.
- **Evaluations and history.** The evaluation rows are denser, a note is one
  tap away, and a student's history opens on the exact session.
- **Dictation** no longer asks to confirm the transcript. Its speed and
  accuracy are unchanged: it is still slow and imprecise, and stays as it is
  for now.
- **Starting over.** Impostazioni can erase the course from the device, after
  a confirmation, and open the creation of a new one.

### Migration

A 0.1.0 or 0.2.0 course opens unchanged: every record, reference, note and
identifier is preserved. A student saved with a date of birth keeps it, and
their age on the first course day is worked out from it; a student whose age
is changed, and every new student, is saved with the age only. No account, server, synchronisation or
second editor is part of this release.

### Known limitations

- **The course lives only on this phone.** There is no export or backup yet.
  Uninstalling the app or clearing the browser's data can delete the course,
  so do not reinstall to update in the middle of a course. Erasing the course
  deletes its rows and compacts the database where the browser allows, but it
  is not a guaranteed wipe on every browser.
- **No iPhone has been tried.** The owner checked the main flows on their
  Android phone — scanning, the assistant paste, offline use, Back, the
  summary images and the update banner. The app icon and launch colour, the
  first offline dictation message and erasing the course were not checked on
  a device, and iPhone/Safari is covered only by browser tests on the WebKit
  engine. The owner has no iPhone; those checks wait until they ask for them.
- **Scanning still needs a look at every row.** A staff row can appear ready
  as a student, and a row whose name reads like a heading can be left out.
- **Dictation is slow and imprecise**, and its model downloads on the first
  dictation rather than with the app.
- **Updating** through the banner works but is not always prompt, and while
  the banner is shown it covers the crew page's floating bar and the Allievi
  add button; the owner found reinstalling more reliable, which, without a
  backup, risks the course data.
- **Create the course before its first Saturday.** Its dates, and so the
  ages and the minor status worked out from a birth date, come from the day
  the course is created; there is no way yet to correct them afterwards.
- **D2–D5 crews stay at two people.** The Settings override for their size is
  still to come; D1 and cabin courses can already resize their crews.
- **Long names on crew cards are cut with "…"** on narrow phones (long names
  from about 390 px wide, and more with enlarged text); the full name stays in the
  accessible name, and a long press opens the student.
- **The project's history was rewritten** before 0.3.0 was published, to
  remove real people's data. GitHub may still serve the old commits by their
  old identifiers until GitHub Support purges them; the owner has not asked.

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
