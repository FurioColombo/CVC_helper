# Several courses and their history — proposal

> Working document · Owner: the owner · Fold at: 0.6.0

Asked by the owner on 2026-11-13, after `B7-PHONE-CHOICE` failed (the PC took
the phone's course with no choice shown): plan several courses in the same week
and a history of past courses, and say whether that makes B7's bug irrelevant.
The owner placed it in 0.6.0, after 0.5.0 (2026-11-13); four questions remain at the end.

## Short answer

- **Several courses is a smaller change than it sounds.** Every row already
  carries its `courseId`, every screen already reads one course by id, and the
  backup already downloads every course of the account
  (`powersync/sync-config.yaml`). Only one course _open at a time_ is enforced,
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

1. **Season calendar.** _I tuoi corsi_ is a calendar of the season's weeks:
   each week a row, its courses as their identities (`D2`, `C1`), the current
   week highlighted, past weeks marked as history. Tapping a course opens it;
   _Nuovo corso_ starts one in the current week. Tapping the course identity on
   Home opens it. Each device remembers which course it shows; that choice is
   local and never synced, so the phone and the PC can show different courses.
   **Landing.** A device that has chosen no course yet (new, restored, or
   its course erased) opens on the calendar, the current week's courses first,
   instead of on _Crea corso_. A device with a chosen course opens straight on
   it, as today: no extra tap in the field.
2. **A new course erases nothing.** _Crea corso_ adds a course and opens it.
   Today it switches the others off (`saveActiveCourse`) and _Elimina il corso e
   inizia un nuovo corso_ erases everything; both stop.
3. **Erase is per course.** _Elimina questo corso_ erases one course, here, on
   the server and on every device (B6's rules, for one id). _Azzera tutti i dati
   locali_ stays device-wide.
4. **Two devices, one offline.** Each makes its course; with signal both have
   both. Nothing asks, nothing is erased.
5. **Restore and sign-in.** An empty device downloads every course. A device
   with its own course keeps it and receives the others: course ids never
   collide, so B5's replace question goes.
6. **Import** adds the file's course; a file whose course is already here asks
   before replacing that one course.
7. **History.** A course is _past_ some days after its end date (owner to
   choose). A past course opens read-only: every screen readable, no edit, no
   duty recalculation. The owner can reopen it, for a late evaluation say.
8. **Vento** follows the course on screen: Derive or Cabinati.

## What it touches

| Area                                                | Change                                                                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/persistence/courses.ts`                        | create without switching others off; erase one course                                                                                         |
| `src/persistence/courseSession.ts`, `backupLink.ts` | bind the device's chosen course, not "the only active one"; drop the "several" and "swapped" reopen                                           |
| `src/features/courseChoice/`, `keep_course`         | retired; the server function dropped by a migration (owner action)                                                                            |
| `src/App.tsx`                                       | the open course comes from the device's choice; the list screen                                                                               |
| `src/backup/session.ts`                             | restore without the replace question                                                                                                          |
| `courseArchive.ts`                                  | import adds a course                                                                                                                          |
| Settings                                            | per-course erase; the reset unchanged                                                                                                         |
| History                                             | a read-only mode the screens honour (the write guard already refuses writes outside the bound course)                                         |
| Compatibility                                       | raise the minimum writer: a 0.5.4 app meeting several courses would offer to erase all but one, so older apps must open read-only (`03` §3.1) |

Design: one new screen (the list) and the Home identity becoming a button,
mocked and approved before code (`field-operations-ui`). Reviews:
data-integrity, sync-chaos, field UX, security/privacy.

## Where it goes

**0.6.0, ahead of sharing** (decisions 28 and 29, 2026-11-13). 0.5.0 ships B7
as it is, with the bug tracked in `docs/working/BACKLOG.md` and the interim
rule in its known limitations; sharing moves to 0.7.0, where inviting a team
to read _a_ course and the volunteer identity below are simpler.

Proposed milestones, for the 0.6.0 plan at its cycle start:

| ID  | Category         | Delivers                                                                                                                                                                                                                                                                                                           | Reviews                                      |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| K1  | FEATURE          | Several courses: points 2–6 and the device's own choice of course, behind a plain list; B7's chooser, swap reopen and `keep_course` retired (a migration, an owner action); the minimum writer raised so 0.5.x apps open read-only. Phone check: two devices, one offline, each makes a course and both keep both. | data-integrity, sync-chaos, security/privacy |
| K2  | FEATURE          | The season calendar and the landing (point 1), the Home identity as its button, Vento following the course on screen (point 8). Mock approved first.                                                                                                                                                               | field UX, accessibility/mobile               |
| K3  | FEATURE          | History (point 7): past courses read-only on every screen, reopening one, and the retention rule once the owner sets it.                                                                                                                                                                                           | data-integrity, security/privacy, field UX   |
| UG5 | INTEGRATION_GATE | A synthetic summer: courses across several weeks on two devices, past ones read-only, restore on a new device.                                                                                                                                                                                                     | as UG4                                       |

K1 first: it changes what a device opens on, and K2's calendar lists what it
holds. K2 can be mocked meanwhile. K3 needs questions 2 and 4 answered.

## Later: who is signing in (0.7.0 and 1.0.0)

The owner's direction (2026-11-13): each person who signs in with an email
says which volunteer they are, or makes a new volunteer profile when they are
not registered yet. Today a volunteer (`01` §5) is a row of one course. That
idea needs a person behind the rows: an account linked to one volunteer
profile, which each course then lists in its own role (ADV, IS, CT). It is how
0.7.0 would invite a course team and 1.0.0 would say who changed what, so it
belongs to those releases. For now the design keeps the door open: a course's
volunteer rows can later point to a profile, and nothing here assumes that one
account is one person forever.

## Questions for the owner

Answered on 2026-11-13: B7 ships as it is (decision 28), several courses come
in 0.6.0 (decision 29). Still open, none needed before 0.6.0 starts:

1. **Same week:** when two courses share a week, is switching between them on
   the calendar enough, or should one screen show both side by side?
2. **When a course becomes past:** a fixed number of days after its end date,
   or only when the owner closes it?
3. **One per week:** may an account hold two courses of the same family and
   level in the same week (two D2 in week 30)? If not, the app says so when
   the second is made, and two devices that each made "D2, week 30" offline
   show both and ask which to keep, or whether to keep both.
4. **Retention:** how long a past course and its minors' data stay, on the
   device and on the server. This is already due before the first real roster
   goes online (`04` "Owner decisions"); history makes it concrete.
