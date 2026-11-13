# Several courses and their history — proposal

> Working document · Owner: the owner · Fold at: UG4

Asked by the owner on 2026-11-13, after `B7-PHONE-CHOICE` failed (the PC took
the phone's course with no choice shown): plan several courses in the same week
and a history of past courses, and say whether that makes B7's bug irrelevant.
Nothing here is decided until the owner answers the questions at the end.

## Short answer

- **Several courses is a smaller change than it sounds.** Every row already
  carries its `courseId`, every screen already reads one course by id, and the
  backup already downloads every course of the account
  (`powersync/sync-config.yaml`). Only one course *open at a time* is enforced,
  in a few places listed below.
- **It retires B7's machinery.** Once two courses on one account are normal,
  nothing has to choose between them or erase one: the chooser, `keep_course`,
  the reopen when a course is swapped and B5's "replace this course?" question
  all go. The bug lived in that machinery or in the timing of its reopen (see
  below), so it most likely goes with it.
- **The history is the part with real decisions:** when a course becomes past
  and read-only, and how long minors' data is kept. Neither blocks the first part.

## What the bug tells us

The owner's path, reproduced on 2026-11-13 against the development backend
(Chromium, two devices, an erase in the app first, one device offline), worked:
both devices showed the choice and the server kept both courses. So the failure
needs something only real devices have: the published build and its service
worker, the PC's shared database worker, or Android's airplane mode. Finding it
is real work for a screen the plan below removes. The same scenario (two
devices, one offline, each making a course) becomes the new milestone's own
phone check, so whether both courses survive is tested again rather than
assumed.

## The behaviour proposed

1. **Course list.** Tapping the course identity on Home (`D2 - 46 | 2026`)
   opens *I tuoi corsi*: the open courses first, then past ones, each with its
   identity, dates and student count, and *Nuovo corso*. Each device remembers
   which course it shows; that choice is local and never synced, so the phone
   and the PC can show different courses.
2. **A new course erases nothing.** *Crea corso* adds a course and opens it.
   Today it switches the others off (`saveActiveCourse`) and *Elimina il corso e
   inizia un nuovo corso* erases everything; both stop.
3. **Erase is per course.** *Elimina questo corso* erases one course, here, on
   the server and on every device (B6's rules, for one id). *Azzera tutti i dati
   locali* stays device-wide.
4. **Two devices, one offline.** Each makes its course; with signal both have
   both. Nothing asks, nothing is erased.
5. **Restore and sign-in.** An empty device downloads every course. A device
   with its own course keeps it and receives the others: course ids never
   collide, so B5's replace question goes.
6. **Import** adds the file's course; a file whose course is already here asks
   before replacing that one course.
7. **History.** A course is *past* some days after its end date (owner to
   choose). A past course opens read-only: every screen readable, no edit, no
   duty recalculation. The owner can reopen it, for a late evaluation say.
8. **Vento** follows the course on screen: Derive or Cabinati.

## What it touches

| Area | Change |
| --- | --- |
| `src/persistence/courses.ts` | create without switching others off; erase one course |
| `src/persistence/courseSession.ts`, `backupLink.ts` | bind the device's chosen course, not "the only active one"; drop the "several" and "swapped" reopen |
| `src/features/courseChoice/`, `keep_course` | retired; the server function dropped by a migration (owner action) |
| `src/App.tsx` | the open course comes from the device's choice; the list screen |
| `src/backup/session.ts` | restore without the replace question |
| `courseArchive.ts` | import adds a course |
| Settings | per-course erase; the reset unchanged |
| History | a read-only mode the screens honour (the write guard already refuses writes outside the bound course) |
| Compatibility | raise the minimum writer: a 0.5.4 app meeting several courses would offer to erase all but one, so older apps must open read-only (`03` §3.1) |

Design: one new screen (the list) and the Home identity becoming a button,
mocked and approved before code (`field-operations-ui`). Reviews:
data-integrity, sync-chaos, field UX, security/privacy.

## Where it goes

| Option | 0.5.0 | Cost |
| --- | --- | --- |
| **A. Replace B7 inside 0.5.0** (recommended) | Several open courses (points 1–6, 8) replace B7's chooser; 0.5.0 ships without the bug's code path. History (point 7) stays with 0.7.0, or moves earlier. | One FEATURE milestone before UG4, about B7's size. B7's chooser is not fixed, then thrown away. |
| B. Fix B7, then several courses later | 0.5.0 keeps the chooser, once its device-only bug is found. | Debugging on real devices, then the chooser removed anyway. |
| C. Ship 0.5.0 with B7's limitation | "Don't make a course on a second device while another is offline", as before B7. Several courses becomes 0.6.0, ahead of sharing. | Cheapest now; the backup carries a known way to lose a course, tolerable only while it holds synthetic data. |

Option A also suits 0.6.0: inviting the team to read *a* course is simpler once
courses are separate things in the app.

With A or C, WX1's test build need not wait for `B7-PHONE-CHOICE`, which has
already failed: it can replace CVC Helper Test 0.5.4 as soon as the owner says
to publish it.

## Questions for the owner

1. **Placement:** A, B or C?
2. **Same week:** several courses open and editable at once, the device showing
   one at a time: is that what "multiple courses for the same week" means, or
   should one screen show two courses side by side?
3. **When a course becomes past:** a fixed number of days after its end date,
   or only when the owner closes it?
4. **Retention:** how long a past course and its minors' data stay, on the
   device and on the server. This is already due before the first real roster
   goes online (`04` "Owner decisions"); history makes it concrete.
