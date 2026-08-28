# Domain and Behavioral Rules v0.1

This document extracts rules from the UX discussion. It is not yet a complete technical data model.

## Core entities

### Course
One active course/week.

Known attributes:
- family: Deriva | Cabinato
- level: 1..5
- ISO week
- year
- generated label

### Student
Known attributes:
- first name
- surname
- display name / nickname
- date of birth
- derived age
- inferred/editable sex
- phone number
- XS–XL size
- initial note
- active/disabled state

Derived:
- minor status from date of birth and relevant date

### Staff member
Instructor or assistant instructor who may embark.

### Boat
- type
- number
- active/disabled
- fault history

### Fault
- boat
- free-text description
- state: Aperta | Comunicata | Risolta
- chronology metadata

### Duty assignment / Comandata
Seven rotations, Saturday through Friday.

### Sailing session
Morning/afternoon operational session.

### Crew
Group of people for one session.

Possible operational destination:
- exact boat
- Mezzi
- boat not yet assigned

`A terra` is not a crew.

### Evaluation
Exactly one optional evaluation per student per session, plus optional note.

Values:
`++`, `+`, `=`, `-`, `--`, none.

## Important invariants / expectations

### Student disabling
Disabling a student:
- preserves history;
- excludes the student from future automatic proposals;
- does not invalidate historical duties or crews.

### Boat disabling
Disabling a boat preserves history and removes it from normal future operational selection.

### Fault status
Boat green/yellow state should be derived from unresolved faults.

### Duty expectations
Normal expectation: every student performs one duty across the course week.

This is deliberately overrideable.

Past duties are facts and should not be revalidated against later student state changes.

### Crew completeness
For a session, each relevant active student should normally appear either:
- in a crew; or
- in `A terra`.

Staff do not count toward this condition.

### Pair history
Only real crews count toward student pair history.
`A terra` does not.
`Mezzi` does.

### Evaluation aggregation
No-evaluation is missing data, not neutral.
`=` is neutral and does count.

Aggregate ranking uses mean evaluated score, not sum.

## Rule categories

When implementing validation, distinguish:

### Blocking technical invalidity
Only use true blocking behavior when data cannot be represented or saved safely.

### Strong warning
An important operational anomaly. User may override.

### Advisory warning
A recommendation that may legitimately be ignored.

The product philosophy is to inform rather than prevent instructor decisions.


## Resolved domain decisions — v0.4

- Course persists real dates plus ISO week/year.
- Session identity is day + AM/PM.
- Boat defaults: D1 RS Toura; D2 RS Quest; D3 RS Quest; D4 Laser Vago; D5 RS 500.
- Cabin working scope: C1 J/80; C2 First 25.7; C3 First 27. C4/C5 out of current practical scope.
- ADV/IS record: one name + role.
- Scan confidence is field-level; uncertain fields remain empty for manual completion.
- Compact student name: unique first name; collision adds surname initial; manual nickname overrides.
- D2–D5 standard crew size = 2.
- Two-person size warnings and crew-repetition rules are normative as specified in `01_UX_SPEC.md`.


## Resolved domain decisions — v0.5

### Comandate generation
- Initial generation distributes relevant students as evenly as possible over 7 duty rotations.
- Midweek recalculation distributes only active/relevant students still needing a normal duty over remaining days.
- Completed rotations are immutable during recalculation.
- Remainders are distributed evenly.
- Generated distribution is only a proposal; manual edits may violate it.
- Red warnings remain visible even when intentional.
- Yellow warnings can be acknowledged/hidden while the underlying situation remains unchanged.
- Only automatic corrective action: `Ricalcola comandate rimanenti`.

### Evaluations
- `A terra` students remain present in the session evaluation list with missing evaluation by default and a contextual indicator.
- They may still be evaluated manually.
- Evaluation notes must be discoverable from the weekly summary via a discreet note indicator.

### Crew UI state
- Primary mobile assignment is tap person → tap crew.
- Announcement mode must work independently of boat assignment.

## Resolved domain decisions — v0.6

### Navigation/domain surfaces
- Bottom nav destinations: Avarie, Home, Equipaggi.
- Home cards: Allievi, Barche, Comandate, Equipaggi, Valutazioni, Volontari.
- Future reference/document/course-note areas are not MVP domain requirements.

### Boats
A boat has an availability state independent from fault state.
- `available`
- `unavailable`

Deletion is reserved for mistaken/undesired entries and is distinct from marking unavailable.

An unavailable boat remains in course/history but is normally excluded from new boat-selection proposals. Existing assignments are not automatically changed; they produce a red warning.

### Crew editing
Within Equipaggi:
- tap selects a person;
- tap destination moves;
- tap another person swaps;
- long press opens student detail.

Selection must be visible in UI state.

### Copying previous crews
Copying previous crews may automatically remove/relocate people invalid for the new session. These changes are reported after the copy, not confirmed beforehand.

### Student notes
Represent at least three distinct note categories:
- initial-course/student-knowledge note;
- optional general course/week note;
- session-specific evaluation note.

### Evaluation history
Student detail must preserve chronological session identity for each evaluation and expose its note. Overview may omit exact session labels if needed for mobile readability, but retains chronological order.

## Finalized semantics — v0.7

- `A terra` is an individual-person placement/status, never a crew destination.
- Crew destinations are `Non assegnato`, a specific sailing boat, or `Mezzi`.
- `Mezzi` is generic motor/support craft; crews assigned there remain real crews and their pair/group history counts normally.
- A sailing boat cannot be assigned to multiple crews in the same session.
- D1 duty does not automatically place a student A terra. Show `C`; D1 morning duty student not A terra produces a red warning.
- Active students neither assigned to a crew nor A terra remain in the available pool and constitute a major completeness issue.
