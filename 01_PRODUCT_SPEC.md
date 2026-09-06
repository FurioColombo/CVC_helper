# Product Specification — 0.2.0 cycle

This is the authoritative source for user-visible behavior and business rules. It
contains the complete 0.1.0 baseline plus the approved 0.2.0 changes. Historical
documents and mock behavior never override it.

## 1. Product and operating context

CVC Helper supports instructors and assistant instructors during one CVC Caprera
sailing-course week. A running instance manages one active course. It is a
mobile-first installable web app for recent Android/Chromium and iPhone/WebKit and
must remain usable offline on one editing device.

The instructor often works hurriedly, tired, outdoors or aboard a support craft.
The interface therefore follows these product rules:

- show the information needed for the current decision together;
- keep input, feedback and warnings near the affected person, day, boat or crew;
- reduce repeated headers, copy, padding and transitions before hiding data;
- keep announcement/reading screens cleaner than composition screens;
- prefer direct choices over menus and typing when the values are known;
- autosave routine valid edits and show honest save, error and retry state;
- let automatic behavior propose while the instructor retains manual control;
- warn about operational anomalies instead of blocking representable states;
- confirm destructive deletion, while routine moves and swaps remain immediate;
- preserve history and avoid workflow locks;
- use colour as reinforcement, always with text, icon or another non-colour cue;
- treat advanced gestures as shortcuts with an explicit accessible equivalent;
- keep voice as an input method and discard audio after transcription.

Detailed density, touch, typography, viewport and component rules live in
`docs/post-mvp/06_DESIGN_RULEBOOK.md`. Page composition targets live in
`docs/post-mvp/07_PAGE_CHANGELOG.md` and mock r10 at commit `ee8d4c8`. They guide
presentation and interaction without changing this document's semantics.

## 2. Course, shell and navigation

If no active course exists, opening the app goes directly to `Crea corso`. Bottom
navigation is hidden during this flow.

The user chooses:

- family: `Deriva` or `Cabinato`;
- level: 1 through 5 where supported.

The app derives and stores real start/end dates, ISO week and year. The visible
identity uses family abbreviation, level, week and year on one line, for example
`D2 - 35 | 2026`. Deriva uses `D`, Cabinato uses `C`; every value changes with the
selected course and date and is never hard-coded in UI copy.

Home shows the intact CVC symbol without the organization wording and exactly six
functional cards:

- Allievi;
- Barche;
- Comandate;
- Equipaggi;
- Valutazioni;
- Volontari.

The persistent bottom navigation has exactly `Avarie`, `Home`, `Equipaggi`, with
Home central. Settings is secondary. Home is not an operational dashboard in
0.2.0.

Course locking, read-only closure and rich historical-course browsing are not
required. Existing course data remains editable.

## 3. Students

### 3.1 Student data and derived identity

A student has:

- first name and surname;
- optional nickname/display-name override;
- date of birth and derived age/minor status;
- sex: `F`, `M` or `Altro`;
- optional phone;
- operational size: XS, S, M, L or XL;
- optional initial knowledge note;
- optional course/week note;
- active/disabled state.

Age and minor status are calculated at the course reference date, not from a
cached age. A minor has an explicit red `M`/`Minorenne` marker whose meaning is
available without colour.

The compact generated name is the unique first name. If first names collide, add
the surname initial, for example `Mario R.`. A manual nickname overrides this.

### 3.2 Student list

The main list is a compact two-column grid; use one column for a state that needs
it, and a third only if names and controls stay unambiguous at the contract
viewport. Each active student shows display name, age, a small sex cue and minor
state. Phone, size, notes and detailed history do not appear in the normal list.

Sort active students by surname and then displayed name. Disabled students remain
visible after active students, greyed out. Advanced sort controls are deferred.

If the course has no students, show `Scan allievi` and `Aggiungi allievo`
prominently. `Aggiungi` remains reachable after scrolling as a floating action and
must not cover the last row or bottom navigation. Secondary actions include Add,
Scan and `Conoscenza allievi`; Conoscenza is disabled until a student exists.

### 3.3 Add, edit, knowledge and notes

Manual creation always remains available. The add/edit form contains personal
data, nickname, phone, direct three-button sex selection, XS–XL size and initial
note. The profile's edit action is labelled `Modifica`.

`Conoscenza allievi` is a compact, editable, once-per-course-ish workflow. For
each student it offers one-tap XS–XL selection and an optional initial note by
typing or voice. Names and actions must remain inside their cards at the stress
viewport.

These note types remain distinct:

1. initial knowledge/experience note;
2. optional general course/week note;
3. evaluation note attached to one student and one session.

The profile edit flow can add/update the course/week note independently from the
initial note. Routine valid changes autosave. The UI must not claim success before persistence,
must preserve the latest typed text on failure and must offer retry. Double click
on desktop or long press on touch may focus a field, but `Modifica` remains the
explicit path.

### 3.4 Profile and history

The profile shows all personal fields, size and initial note. When other notes
exist, show up to two recent notes and an `Altre` action for the rest; omit the
section when none exist. Body copy uses normal/light weight rather than heavy
display type.

The Valutazioni card contains the same complete weekly grid used in P18/P19. It
fits without horizontal scrolling. The read-only history starts with that grid,
then groups sessions by day with AM/PM subcards and their notes. The student's
name is the main sticky subject while the list scrolls. Editing remains in the
Valutazioni workflow.

### 3.5 Disable and delete

Disabling preserves all history, removes the student from future operational
pools/proposals and does not invalidate past duties, crews or evaluations.
Re-enabling restores future availability without changing history.

Permanent deletion is allowed only when the student has never been referenced.
Any duty assignment, crew membership, A-terra placement, evaluation, evaluation
note or other persisted operational/history reference blocks it. The UI lists the
blocking reasons and offers disable instead. Deletion is confirmed, atomic,
non-cascading and has no generic Undo.

### 3.6 Scan students

Scan accepts a screenshot or photograph of a variable-layout printed sheet. The
entry offers `Scegli dalla galleria` or `Fai una foto`; camera acquisition uses the
available full-screen surface, then free rotation and crop.

Extraction attempts first name, surname, date of birth and phone when present.
Age is derived. Sex inference is only a convenience and is always editable.

Confidence is field-level. Keep a field only when reasonably reliable; otherwise
leave it empty. A reliable name may survive with a missing date and vice versa.
Blurred, cropped or unreliable images prompt retake/re-upload rather than false
certainty.

Human review is mandatory before commit. Rows and fields are editable; false rows
can be removed. Sticky live counters show rows to check, fields to complete and
students ready/inserted, updating after every change. Source photos are not
retained as application data.

## 4. Boats and faults

### 4.1 Canonical models and setup

Operational course defaults are:

| Course | Default boat |
| --- | --- |
| D1 | RS Toura |
| D2 | RS Quest |
| D3 | RS Quest |
| D4 | Laser Vago |
| D5 | RS 500 |
| C1 | J/80 |
| C2 | First 25.7 |
| C3 | First 27 |

C4/C5 have no current operational mapping. The user may change the default from
the canonical allowed-model list.

Initial setup primarily asks for numbers. It accepts commas, whitespace, newlines
and semicolons; repeated separators create no empty records and identical
model+number entries are deduplicated. If setup is reached after boats already
exist, show them so the user can avoid adding duplicates.

A model mark may be used only when the asset is permitted and recognizable at the
rendered size. A same-size neutral model-name fallback is always valid. Model and
number form one compact identity; two-digit numbers must not be clipped.

### 4.2 Availability and lifecycle

Availability is independent from fault state:

- `available`: eligible for new session selection;
- `unavailable`: retained and greyed, normally excluded from new selection.

Deletion removes only a mistaken/undesired boat entry and must respect history.
Disabling never deletes history. If an assigned boat later becomes unavailable,
keep the assignment and show a red warning; do not silently clear it.

In list language:

- `Disponibile`: neutral, no unresolved fault;
- `Da controllare`: yellow, at least one unresolved fault;
- `Non disponibile`: grey, regardless of fault history.

Every state has a label/icon as well as colour.

### 4.3 Faults

A fault belongs to one boat and has free text, timestamps and one state:

1. `Aperta`;
2. `Comunicata` (reported to maintenance/repair people);
3. `Risolta`.

Fault cards use the boat identity, a useful multi-line text preview and direct
compact state controls. Full text is one tap away. Text is typed or dictated in
the same panel; there is no separate dictation page. Audio is discarded. State
changes are fast and persisted; a resolved fault remains in history. Changing a
fault never changes course availability.

## 5. Volunteers

Volunteers are separate people with a non-empty name and exactly one role: ADV,
IS or CT. The add/edit form starts empty and uses direct role selection.

All three roles may embark and appear under `Volontari disponibili` in Equipaggi.
They are excluded from student duty logic, evaluations and student-completeness
counts. Permanent explanatory copy need not occupy the operational screen.

## 6. Comandate

### 6.1 Time and main view

There are seven rotations: Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday
and Friday. A named rotation begins that afternoon/evening and ends after lunch
the next day; Friday is particularly suitable for students staying the following
week.

The main view shows all seven groups with their names in top-aligned compact
cards. It includes unique assigned/total feedback: neutral when equal, yellow
when people are missing. Completed rotations are visually recognizable.

Warnings are localized on the affected day and person using vector icons. Tap
reveals reasons; a general Avvisi view stays secondary. A red major warning stays
visible after acceptance. A yellow advisory warning may be acknowledged while
the underlying condition remains unchanged.

### 6.2 Automatic proposal

The configuration uses currently eligible people and remaining days, asks which
students stay next week, and offers compact minor/sex balancing switches.

Let `N` be eligible people and `D` selected remaining days. Assign
`floor(N / D)` to every day and require exactly `N mod D` selected
`Giorni con più persone`, each receiving one extra. If `N < D`, base is zero and
exactly `N` extra days are selected. Every student can be selected as stay-over.

Within those capacities, priority is:

1. fill Friday with stay-over students only to its capacity;
2. distribute minors as evenly as possible;
3. when enabled, distribute sex as evenly as possible;
4. apply deterministic surname ordering, with similar-age grouping only as an
   optional alternative tie-break.

The preview does not mutate persisted assignments. Only confirmation commits it.
Afterward every day is freely editable, including zero, repeated or deliberately
unbalanced assignments.

### 6.3 Midweek recalculation and validation

`Ricalcola comandate rimanenti` is the only automatic corrective operation. It
keeps completed rotations immutable, considers current active/relevant students
who still need a normal duty and recomputes only remaining days. It uses the same
formula and priorities. Manual exceptions remain possible.

Past completed duties are facts and do not warn because a student's later state
changed. Current/future warnings cover missing, repeated or disabled students,
configured headcount, incomplete assignments, Friday stay-over preference and
minor/sex imbalance. Do not warn merely because more stay-over students exist
after Friday's configured capacity is filled.

Normal expectation is one duty per student over the week, but intentional repeats
are valid and never blocked.

### 6.4 Direct day editing

Tapping a P11 day opens P13 directly. There is no intermediate popup or duplicate
instruction banner. P13 orders people as:

1. assigned to the current day;
2. never assigned;
3. assigned to other days.

Show two students per row. Day labels in cards use Lun, Mar, Mer, Gio, Ven, Sab,
Dom; accessible names remain complete. Tapping the neutral name surface adds the
person to the current day; a discreet plus signals that action without a solid
blue button. A compact red X removes only the labelled day. Multiple assignments
remain allowed; a red warning lists all affected days.

## 7. Equipaggi

### 7.1 Sessions and setup

Sessions run in this fixed order: Saturday PM, then Sunday AM/PM through Friday
AM/PM, for thirteen sessions. Identity is day plus AM/PM; no operational timestamp
is required.

Before composing, choose the number of crews. Keep separate:

- number of crews;
- people per crew;
- boats assigned to the course;
- boats selected for this outing;
- exact crew-to-boat assignment.

D2–D5 crews contain exactly two people. D1 and cabin courses may use larger,
non-fixed crews: propose an even initial distribution across the chosen crews and
allow unrestricted manual adjustment. Fixed formulas for those courses are
outside 0.2.0.

### 7.2 People, A terra and composition

The student pool shows available/unassigned students and may include compact size,
current duty (`C`), just-finished duty (`SM`) and relevant history cues. It does
not include assigned people. A separate lower-priority pool shows volunteers.

Every active relevant student should normally be in a real crew or `A terra`.
`A terra` is an individual placement, counts as accounted for and never counts as
a crew or pair-history event. Volunteers are excluded from this completeness.

The workspace shows several crews at once. Primary interaction is tap person then
free slot/crew; tap another assigned person to swap. Selection is visible. Double
click/tap on an assigned student returns only that person to Disponibili and frees
the slot; an explicit accessible command does the same. Long press may open the
profile but is never the sole path.

`A terra` and `Volontari` remain reachable at the lower left/right without covering
content, with the compact placed/total count between them. Missing people remain
immediately visible; there is no separate missing-person dialog and no generic
Undo.

### 7.3 Crew destinations and session boats

A crew destination is exactly one of:

- `Non assegnato`;
- one selected sailing boat;
- `Mezzi` (generic active support/motor craft).

`A terra` is never a crew destination. Mezzi is a real crew and counts in pair and
group history.

The session boat strip is sticky, wraps to two rows and never scrolls horizontally.
Sort numbers numerically. Each boat is:

- grey: unavailable;
- blue: available and not assigned;
- green: assigned to a crew.

The compact destination popup uses the same states and order. To assign, select a
crew without a boat and tap a blue boat. Persist one mapping for the open session;
the boat becomes green and both summaries update. A sailing boat cannot belong to
two crews in one session.

Removing a boat from the current outing clears only that session's crew-to-boat
link and preserves people and every other session. Marking a course boat
unavailable instead preserves existing links and shows red. An unresolved fault
shows yellow and does not automatically block use.

For every session after Saturday PM, offer secondary copy actions for previous
crews and previous boat set. Each copied session becomes independently editable.
Crew copy removes/relocates people invalid for the new session, leaves visible
gaps and shows an informational post-copy list only when changes occurred. Boat
copy is preview → edit → confirm.

### 7.4 Crew warnings

Warnings advise and never modify crews. Show at most one triangle per crew using
the highest severity; tap reveals every reason, keeping crew and boat reasons
distinct.

For two-person size combinations use exactly:

| Combination | Severity |
| --- | --- |
| XS + XS | Red |
| XS + S | Red |
| XS + M | Yellow |
| S + S | Red |
| S + M | None |
| M + M | None |
| M + L | None |
| M + XL | None |
| L + L | Yellow |
| L + XL | Red |
| XL + XL | Red |

Order is irrelevant. Do not infer unlisted size warnings.

For two-person repetition: same pair in any previous three sessions is red; an
older repeat is yellow; never together has no repetition warning. For crews of
three or more, an identical previous whole crew is red and each internal pair is
also checked using the same recent/older rule. Do not implement fuzzy similarity.

Other strong warnings include an active student missing from crew/A terra and a
D1 morning-duty student who is not A terra. A duty assignment alone does not
automatically move a student A terra.

### 7.5 Read/announcement view

Announcement mode removes editing and decision-support detail. Each compact row
separates crew number, recognizable model/logo plus number or no boat, and people.
It supports exact boat, model without number, no boat and Mezzi. A permitted model
asset is optional; the same-size text fallback is required. Screen wake lock is
allowed when straightforward; native brightness control is deferred.

## 8. Evaluations

Evaluations belong to one student and one session. Values are `++`, `+`, `=`, `-`,
`--` or missing. Missing is the default and is distinct from the real neutral `=`.

Opening Valutazioni selects the most relevant recently completed session. The
user can choose any course session. Two entry views edit the same records:

- `Allievi`: normal/alphabetical student list;
- `Equipaggi`: students grouped by that session's final crews as a memory aid.

Students in A terra remain visible with a small contextual cue and missing value
by default, but may be evaluated.

The full name and five value controls share one row. Values use aligned vector
icons; positives are green, negatives red and neutral distinct. A second tap on
the selected value clears it. There is no sixth absence control. Tapping the name
opens the note editor in the same panel. Notes accept typing or voice and remain
attached to the exact session. Past records remain editable.

`Riepilogo` shows one compact student card with a complete seven-day × AM/PM grid,
a 40 px name row, actual evaluation count and an `Ordinamento` label above compact
alphabetical/evaluation controls. Missing cells are blank, never dash or tilde.
The complete aligned grid fits without horizontal scrolling. A note icon opens
the exact note; tapping the name opens the profile history.

The profile history shows the same grid at the top, then a sticky student title
and compact day cards containing AM/PM values and notes. It is read-only.

For internal ordering only, map `++` to 2, `+` to 1, `=` to 0, `-` to -1 and `--`
to -2. Use the mean of present evaluations, never the sum. Missing values are
excluded. No numeric score is shown.

## 9. Speech and OCR capability behavior

UI/domain code depends on small provider-independent capabilities equivalent to
`scanStudents(image)` and `transcribeAudio(audio)`. Provider selection is not a
user choice.

Speech-enabled contexts are initial knowledge notes, boat faults and evaluation
notes. All use the same in-panel flow:

request permission after the user taps Detta → load real assets with honest
progress → record → process → show editable Italian text → save text → discard
audio.

The UI preserves typed text on denial/failure, supports real cancel/retry and never
shows invented progress. Reliability is verified on PC, Android and iPhone with
automated fixtures plus physical checks. Latency is measured and reported; no
fixed threshold is invented before evidence exists.

OCR uses the acquisition/review contract in section 3.6. Quality is measured
against anonymous/synthetic field/person truth. Aim near 90% of readable fields on
typical fixtures while preferring empty/manual correction over a confident wrong
association. Human review, not the percentage alone, controls commit.

## 10. Persistence, privacy and future sharing

All operational reads and writes use the local database and survive page/app
closure. Data created by 0.1.0 must remain readable without losing people, duties,
crews, A-terra placements, boats, faults, evaluations or notes. Schema changes
require a tested migration and must preserve stable IDs/references.

Only true technical invalidity blocks storage. Routine recoverable errors stay in
context with retry. Operations that unlink a session boat or assign it to a crew
must be coherent and session-local; student deletion must be atomic.

Phone and other personal data appear only where operationally relevant, never in
announcement rows. All app users are assumed to be authorized instructors or
assistant instructors; that assumption does not justify showing irrelevant data.

Expected future progression is local single device, then read-only sharing, then
multi-editor sync if justified. Backend, authentication, synchronization and
conflict UI are outside 0.2.0.

## 11. Canonical domain truth and invariants

Finite values and mappings are represented once in typed domain configuration and
used by UI, logic and tests.

Canonical sequences and enums:

- sessions: `sat-pm`, then `sun-am`, `sun-pm` through `fri-am`, `fri-pm`;
- duty days: Saturday through Friday;
- sizes: XS, S, M, L, XL;
- sex: F, M, Altro (internal identifiers may differ if mapping is explicit);
- volunteer roles: ADV, IS, CT;
- fault states: open, reported, resolved;
- boat availability: available, unavailable;
- crew destinations: unassigned, boat, mezzi;
- evaluation values: `++`, `+`, `=`, `-`, `--`, missing.

The persisted course state must reject or report, at minimum:

- duplicate entity IDs or duplicate model+boat-number identity;
- dangling student, volunteer, boat, fault, session or evaluation references;
- invalid canonical enum/session/day values;
- one student both in a crew and A terra, or assigned more than once in a session;
- one volunteer assigned more than once in a session;
- one sailing boat assigned to multiple crews in the same session;
- crew boat assignment without that boat selected for the session;
- duplicate student/session evaluations;
- invalid or reversed fault timestamps.

User-facing warnings are separate from integrity failures. They explain unusual
but representable operational choices and preserve manual override.

## 12. Scope boundary

The included and deferred 0.2.0 boundary is authoritative in
`02_MVP_SCOPE.md`; implementation order and evidence live in
`04_IMPLEMENTATION_PLAN.md`. In particular, 0.2.0 does not add backend/sync,
automatic crew optimization, dashboards, Instagram imagery, a broad custom icon
programme, native brightness control, presentation exports, evaluation-band crew
hints or fixed special-course crew formulas.
