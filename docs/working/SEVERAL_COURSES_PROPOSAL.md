# Several courses and their history — proposal

> Working document · Owner: the owner · Fold at: 0.6.0

Asked by the owner on 2026-11-13, after `B7-PHONE-CHOICE` failed (the PC took
the phone's course with no choice shown): plan several courses in the same week
and a history of past courses, and say whether that makes B7's bug irrelevant.
The owner ruled it out of 0.5.0 (2026-11-13); the rest waits for the questions at the end.

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

## The season in practice

The centre runs several courses each week, one per family and level, at three
bases, each with its own CT and team (`01` §2; the volunteers' guide, Allegato
2, local only). One owner could in theory hold every course of every week; in
practice (owner, 2026-11-13) next summer brings a few C1, C2, D1 and D2 spread
over the weeks, each created in its own week. So the app holds a dozen or so
courses a season, rarely two in the same week, and the course identity
(`D2 - 46 | 2026`) already names family, level, week and year.

## The behaviour proposed

1. **Season calendar.** *I tuoi corsi* is a calendar of the season's weeks:
   each week a row, its courses as their identities (`D2`, `C1`), the current
   week highlighted, past weeks marked as history. Tapping a course opens it;
   *Nuovo corso* starts one in the current week. Tapping the course identity on
   Home opens it. Each device remembers which course it shows; that choice is
   local and never synced, so the phone and the PC can show different courses.
   **Landing.** A device that has chosen no course yet (new, restored, or
   its course erased) opens on the calendar, the current week's courses first,
   instead of on *Crea corso*. A device with a chosen course opens straight on
   it, as today: no extra tap in the field.
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

**Not in 0.5.0** (owner, 2026-11-13). Two releases fit:

- **0.6.0, ahead of sharing** (recommended): several courses and the season
  calendar first, sharing after. Inviting a team to read *a* course, and the
  volunteer identity below, are simpler once courses are separate things in
  the app. Sharing moves to 0.7.0.
- **0.7.0, as planned** (`02` §4): sharing first, in an app that still holds
  one course at a time.

**What that leaves for 0.5.0.** B7's chooser stays, and its owner check failed
on real devices only. Two ways to close it:

- **Accept the limitation** (recommended, given "not too much effort"): B7
  closes with the owner's failed step recorded as a known limitation, and the
  interim rule from before B7 comes back in the release notes: make a course on
  one device at a time, never on a second one while another is offline. The
  backup holds synthetic data only until the owner's data decisions, so no real
  roster is at risk, and several courses later removes the code path.
- **Find the device bug:** debug on the published build with the owner's phone
  and PC. Real effort for a screen that is later removed.

Either way, WX1's test build need not wait for `B7-PHONE-CHOICE`, which has
already been answered: it can replace CVC Helper Test 0.5.4 as soon as the
owner says to publish it.

## Later: who is signing in (0.6.0 and 1.0.0)

The owner's direction (2026-11-13): each person who signs in with an email
says which volunteer they are, or makes a new volunteer profile when they are
not registered yet. Today a volunteer (`01` §5) is a row of one course. That
idea needs a person behind the rows: an account linked to one volunteer
profile, which each course then lists in its own role (ADV, IS, CT). It is how
0.6.0 would invite a course team and 1.0.0 would say who changed what, so it
belongs to those releases. For now the design keeps the door open: a course's
volunteer rows can later point to a profile, and nothing here assumes that one
account is one person forever.

## Questions for the owner

1. **B7 in 0.5.0:** close it with the known limitation, or find the device bug?
2. **Release:** several courses in 0.6.0 ahead of sharing, or 0.7.0 as planned?
3. **Same week:** when two courses share a week, is switching between them on
   the calendar enough, or should one screen show both side by side?
4. **When a course becomes past:** a fixed number of days after its end date,
   or only when the owner closes it?
5. **One per week:** may an account hold two courses of the same family and
   level in the same week (two D2 in week 30)? If not, the app says so when
   the second is made, and two devices that each made "D2, week 30" offline
   show both and ask which to keep, or whether to keep both.
6. **Retention:** how long a past course and its minors' data stay, on the
   device and on the server. This is already due before the first real roster
   goes online (`04` "Owner decisions"); history makes it concrete.
