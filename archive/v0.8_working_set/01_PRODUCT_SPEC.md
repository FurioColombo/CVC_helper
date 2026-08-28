# Product Specification

Authoritative source for user-visible behavior and business rules. Historical material never overrides this document.

## 1. Product context

The app supports instructors and assistant instructors during one CVC Caprera sailing course week.

A running instance manages **one active course**, not several simultaneous courses.

The interface is mobile-first and should work well as an installable web app on Android and iPhone.

## 2. UX principles

- Show only information useful for the current task.
- Decision screens may be information-dense.
- Reading/announcement screens must be extremely clean.
- Automatic behavior proposes; the instructor decides.
- Manual override is always possible.
- Avoid irreversible deletion where historical information matters.
- Last-minute operational changes must require very few interactions.
- Voice input is a shortcut for entering text; audio does not need to be retained.
- Minimize typing. Whenever plausible values are known, prefer direct selection, buttons, chips, toggles, lists, or other clickable controls over free-text entry.
- Free-text input should primarily be used for genuinely open-ended information such as names, notes, and fault descriptions; where practical, scanning or voice input should provide an alternative.
- Do not introduce workflow locks merely because a conceptual phase is complete.

---

# 3. First launch and course creation

If no active course exists, opening the app goes directly to **Create course**.

The user selects:

- course family: `Deriva` or `Cabinato`;
- level: `1` through `5`.

The UI generates a course label from:

- course family abbreviation;
- level;
- current ISO week number;
- current year.

Example:

`D2 35 2026`

Week and year are derived automatically rather than typed manually.

After confirmation, the user reaches the course home.

---

# 4. Course home

Primary entries:

- Allievi
- Barche
- Comandate
- Equipaggi
- Valutazioni

A separate settings control opens secondary configuration.

A secondary area, provisionally named `Gestione volontari`, manages ADV/IS people who may embark and therefore need to be available in Equipaggi.

Do not turn the home into a dashboard unless later requirements justify it.

---

# 5. Allievi

## 5.1 Main list

The normal view is a single-column list or compact cards.

Each active student shows only:

- display name / name;
- age;
- sex indicator.

No phone number, physical information, notes, or detailed history appears in the normal list.

Minors must be visually unmistakable. A red visual marker is required.

Disabled students remain visible but are greyed out.

## 5.2 Empty state

If there are no students, replace the normal list with prominent actions:

- `Scan allievi`
- `Aggiungi allievo`

The user should understand how to start without opening another menu.

## 5.3 Secondary student menu

A collapsible side/secondary menu provides:

- Aggiungi allievo
- Scan allievi
- Conoscenza allievi

`Conoscenza allievi` is disabled until at least one student exists.

Naming is still provisional, especially `Conoscenza allievi`.

## 5.4 Scan allievi

Input may be:

- a photo of a printed sheet;
- a screenshot.

The source layout is not guaranteed to be stable.

The extraction flow should attempt to obtain at least:

- first name;
- surname;
- date of birth;
- phone number when present.

Age is calculated from date of birth.

Sex is inferred from the name as a convenience, but is always directly editable. Corrections should not produce unnecessary warnings.

The scan flow must estimate whether extraction worked with sufficient confidence.

If the source image is unsuitable (blurred, cropped, unreadable, or otherwise too uncertain), explicitly suggest retaking/re-uploading it instead of presenting unreliable extracted data as trustworthy.

After extraction, always show a human review step before committing students. The user can inspect extracted rows, quickly correct fields, remove false rows, and confirm only students that should actually be added.

Where useful, low-confidence fields or rows should be visually identified. Exact confidence thresholds are a technical decision.

All extracted fields must be easy to correct.

Nice-to-have, not mandatory for the first MVP: add names/students through a spoken command, followed by review and confirmation before saving.

## 5.5 Manual student creation

Manual creation must remain available even when scanning exists.

## 5.6 Conoscenza allievi

This is a once-per-course-ish workflow performed after instructors have met the students. It remains editable later.

Show all students compactly.

For each student provide:

### Physical size

Dropdown:

- XS
- S
- M
- L
- XL

This deliberately compresses height/build/weight into one rough operational descriptor.

### Initial note

Optional.

The expected/default state is no special note beyond the expected previous-course level.

The note can be entered:

- by typing;
- by voice transcription.

Voice audio is discarded after transcription. The resulting text is editable.

Example information may include prior sailing experience, previous recommendations, special mentions, or unusually strong/weak starting level.

## 5.7 Student detail

Show at least:

- first name;
- surname;
- age;
- date of birth;
- sex;
- phone number;
- display name / nickname;
- XS–XL size;
- initial knowledge/experience note.

If the student is a minor, show an explicit red `Minorenne` marker.

The student can be disabled/re-enabled here.

Disabling does not erase historical data.

## 5.8 Student evaluation history

Student detail contains a read-only history of evaluations.

Conceptually this is a two-row weekly grid:

- morning;
- afternoon.

Columns correspond to course days/sessions.

Possible values:

- `++`
- `+`
- `=`
- `-`
- `--`
- no evaluation

`=` means a real neutral/in-line evaluation.

No evaluation is distinct and must not contribute to aggregates.

Evaluation editing happens in the Valutazioni workflow, not here.

---

# 6. Barche

## 6.1 Main list

Show all boats assigned to the course.

Each item should show only what is operationally useful, principally:

- boat type;
- boat number;
- status indicator.

Status:

- green: no unresolved faults;
- yellow: at least one unresolved fault;
- greyed: boat disabled for the course.

Do not require a manually maintained green/yellow status if it can be derived from faults.

## 6.2 Empty state / configuration

If no boats exist, show a prominent `Configura barche` action.

The course type provides the default boat model.

The user primarily enters the numbers of the boats assigned to the course.

The default type is editable.

## 6.3 Add boat

A `+` action adds another boat.

The boat type defaults to the course's expected type but can be changed through a dropdown containing available boat types.

## 6.4 Boat detail

Show current unresolved faults prominently and resolved fault history secondarily.

The boat can be disabled/re-enabled without deleting history.

## 6.5 Fault entry

A fault is primarily free text.

Examples:

- `strozzascotte D sinistra rotto`
- `scotta randa senza anima`
- `rollafiocco da controllare`

Input:

- typed text;
- voice transcription.

Do not retain the audio.

Fault state:

1. Aperta
2. Comunicata
3. Risolta

`Comunicata` means the issue has been reported to the relevant maintenance/repair people.

State changes must be fast.

A resolved fault remains in history.

---

# 7. Comandate

## 7.1 Time model

The course week starts Saturday afternoon and ends Saturday morning.

There are seven duty rotations:

- Saturday
- Sunday
- Monday
- Tuesday
- Wednesday
- Thursday
- Friday

A named day's duty begins that afternoon/evening and finishes after lunch the following day.

Example:

`Comandata sabato` starts Saturday around 18:00 and ends after Sunday lunch.

The Friday duty ends after Saturday lunch and is particularly suitable for students staying for the following week.

## 7.2 Main view

Show the seven duty groups clearly, with assigned students.

Support:

- manual assignment;
- automatic proposal.

## 7.3 Automatic proposal configuration

The generator should ask/configure at least:

- which students stay the following week;
- desired number of students per duty/day;
- which days should contain fewer students when the total is not evenly divisible;
- whether to balance minors;
- whether to balance sex.

## 7.4 Automatic assignment priorities

Priority order:

1. Prefer students staying the following week for Friday, only to the extent needed to fill Friday's configured capacity.
2. Distribute minors as evenly as possible.
3. If enabled, distribute male/female students as evenly as possible.
4. Apply the configured deterministic tie-breaker.

Default tie-breaker: surname alphabetical order.

Optional alternative tie-breaker: prefer grouping students of similar age.

The age-based rule is applied only after the higher-priority rules above. Alphabetical order is not a pedagogical rule; it is a deterministic fallback.

## 7.5 Re-running automatic assignment during the week

Automatic assignment must also work after the week has started.

Completed duty rotations are immutable historical state. If three students completed Saturday duty, re-running the generator on Sunday must not assign those students another normal duty.

The generator recomputes only the current/future portion that still needs planning, using completed assignments, current active/disabled student state, current configuration, and the same assignment priorities. Manual exceptions remain possible.

The Friday preference is capacity-aware. Example: with 21 students, 3 duty slots per day, and many students staying the following week, if Friday's three slots are already occupied by three stay-over students, the Friday preference is fully satisfied. Do not warn merely because other stay-over students are assigned to other days.

## 7.6 Validation philosophy

Validation applies differently to history and the future.

Past completed duties are historical facts and must not generate warnings merely because the student's current state changed.

Example: a student disabled on Tuesday may legitimately have completed Sunday duty.

Across the whole week, the normal expectation is that each student performs one duty.

Important anomalies include:

- a student never assigned during the whole week;
- a student assigned multiple times;
- a disabled student assigned to a future duty;
- configured headcount not respected;
- incomplete assignments.

These are strong warnings, not unbreakable locks.

Manual override is always allowed.

A student may intentionally perform two or three duties, for example as a disciplinary decision.

Once a specific anomaly is explicitly accepted by the user, avoid repeatedly nagging about the unchanged intentional exception.

## 7.7 Advisory warnings

For current/future duties, advisory checks include:

- students staying next week not favored for Friday;
- uneven distribution of minors;
- uneven sex distribution when that option is enabled.

## 7.8 Fixing validation issues

Validation should:

1. explain the issue;
2. offer manual correction;
3. where reasonable, offer an automatic minimal fix.

Automatic fixing should preserve as much of the user's existing assignment as possible rather than regenerating the entire week.

Also consider `Ricalcola comandate rimanenti`: recompute the remaining current/future plan while preserving completed turns as immutable history and taking the current state into account.

This full remaining-plan recomputation is desirable but may be deferred beyond the first MVP if it materially increases complexity.

---

# 8. Equipaggi

## 8.1 Session model

Equipaggi belong to a specific sailing session.

Course sessions run from Saturday afternoon through Friday afternoon, with morning/afternoon sessions as applicable.

For every session except Saturday afternoon, offer `Copia equipaggi sessione precedente`.

This copies the immediately preceding session as the starting point, whether the transition is morning → afternoon or afternoon → next morning.

A copied session becomes independently editable.

## 8.2 Session setup

Before composing crews, select the number of crews to create.

The following are separate concepts and must not be conflated:

- number of crews;
- number of people per crew;
- number of boats assigned to the course;
- number of boats actually going out in the session.

The number of crews multiplied by the number of people per crew does not imply the number of available boats or the number of boats that will go out.

For `D2`, `D3`, `D4`, and `D5`, standard crews contain exactly 2 people.

Other course types, including `D1` and cabin courses, may have larger and non-fixed crew sizes. For these, propose an initial even distribution based on available people and the selected number of crews, then allow manual adjustment.

Further exact rules by non-D2–D5 course type remain TBD.

## 8.3 Available people

During composition, student entries may show compact decision-support information:

- display name;
- XS–XL size;
- duty status;
- recent evaluation indicator.

Duty indicators are session-aware.

In the afternoon it can be useful to distinguish:

- currently on duty (`C`);
- just finished duty / smontante (`SM`).

For the morning, current duty status is the important information.

POST-MVP — do not implement initially: a compact `+` or `-` indicator may identify students in roughly the upper/lower evaluation band accumulated so far.

The exact aggregation/tie rule should be documented before implementing this future feature.

## 8.4 ADV / IS / volunteers

ADV and IS who may embark must be registered separately from students, provisionally through `Gestione volontari`.

They are additional people, not students, and must be visually distinguishable in the available-person pool.

They:
- can be placed in crews;
- do not satisfy student-completeness checks;
- are not part of student evaluations;
- are not part of student duty logic.

The exact fields and final naming/location of `Gestione volontari` remain TBD.

## 8.5 `A terra`

Each session has a special non-crew group: `A terra`.

Examples:

- D1 students who cannot sail because of duty;
- injured student;
- another session-specific exception.

A student in `A terra` counts as accounted for during session completeness validation.

`A terra` is not a crew and must not contribute to:

- crew-pair history;
- repeated-pair statistics;
- crew balance warnings.

## 8.6 Composition workspace

The UI must allow several crews to be built simultaneously.

Do not force the user to finish Crew 1 before placing someone in Crew 2.

The user must be able to place people provisionally and rearrange them quickly.

Show a compact completion counter.

## 8.7 Boats versus crews

Crew composition and boat assignment are separate concepts.

A session can have completed crews without exact boat numbers assigned.

After crews are made, the user may define which boats actually go out in the session.

For every session after the first, offer `Copia barche sessione precedente`.

Flow:

**copy previous set → show current selection → optionally edit → confirm**

Do not require typing boat numbers when the app already knows the boats assigned to the course. Show available course boats as directly selectable options and let the user tap the boats that will go out.

Example: if course boats are `Quest 2, 3, 7, 8, 11`, the session selection should behave conceptually like:

`✓ 2   ✓ 3   ✓ 7   ○ 8   ✓ 11`

Then crews can optionally be associated with exact selected boats.

Crew composition, session boat-set selection, and exact crew-to-boat assignment remain separate concepts.

## 8.8 `Mezzi`

`Mezzi` is not the same as `A terra`.

A crew assigned to `Mezzi` is an active crew for the session but initially has no sailing boat assigned.

It remains a real crew and contributes normally to crew history and checks.

## 8.9 Crew verification

Verification is advisory: it does not automatically change crews.

The user should be able to inspect warnings and decide.

In the compact all-crews view, show at most one warning triangle per crew, using the severity of the most important issue.

Tap the triangle to see all underlying issues.

Possible severity examples:

### Red

- exact same pair as the immediately previous session;
- extremely light crew such as two XS;
- extremely heavy crew such as two XL.

### Yellow

- moderately light/heavy crew;
- two students both in the negative evaluation group.

Exact size thresholds remain TBD.

Historical pairing information should also be available, such as:

- number of previous sessions together;
- when they were last together.

Not every historical repetition needs to generate a warning.

## 8.10 Different usage moments

The same session/crew data supports four distinct UX contexts.

### Compose

Show decision-support information: sizes, duty status, evaluation hints, pair history.

### Verify

Emphasize warning triangles and explanations.

### Read / announce

Show an extremely clean list, primarily names and optional boat assignment.

This view is intended for quickly reading crews aloud and for checking them while on the water.

### Quick edit

After crews have been made, allow immediate swaps/replacements and later boat assignment without reopening a long creation wizard.

Do not impose a rigid Draft → Final lock.

Last-minute changes overwrite the current session state. MVP does not need version history.

## 8.11 Session completeness

Every active student relevant to the session should normally be either:

- in a real crew; or
- in `A terra`.

Missing students should be clearly flagged.

Staff are excluded from this completeness requirement.

---

# 9. Valutazioni

## 9.1 Home entry

`Valutazioni` is a primary home entry because evaluation happens at a distinct moment after a sailing session.

## 9.2 Default session

Opening Valutazioni should default to the most relevant recently completed session based on date/time.

The user can navigate to any other course session.

The expected course evaluation window runs from Saturday afternoon through Friday afternoon.

## 9.3 Two views for entering evaluations

### Allievi

Alphabetical/normal student list for quickly finding a person.

### Equipaggi

Show students grouped according to the final crew composition of that session.

The evaluation remains individual. Crew grouping exists only as a memory aid.

Both views edit the same underlying student-session evaluation.

## 9.4 Evaluation input

Possible values:

- `++`
- `+`
- `=`
- `-`
- `--`
- no evaluation

No evaluation is the default.

A value should be selectable directly from the list without opening student detail.

An optional note can be added by:

- typing;
- voice transcription.

The audio is discarded.

Past session evaluations remain editable.

## 9.5 Overview / Riepilogo

Provide an `Overview` / `Riepilogo` view across the whole course.

Each student appears with the compact sequence of evaluations accumulated so far.

Do not require opening sessions one by one.

Support at least:

- alphabetical ordering;
- ordering from strongest to weakest aggregate evaluation.

For internal aggregation:

- `++` = +2
- `+` = +1
- `=` = 0
- `-` = -1
- `--` = -2
- no evaluation = excluded

Use the mean of actual evaluations rather than the sum so students are not rewarded merely for having more observations.

The numeric score does not need to be displayed.

Show the number of actual evaluations for each student. This is useful operational information and does not need to be hidden; students are not expected to access this interface.

---

# 10. Sharing and persistence direction

Sharing is core to the product vision but not necessarily required for the first useful build.

Preferred progression:

1. useful single-device/local version;
2. read-only sharing;
3. multi-user editing if justified.

The code should not unnecessarily make later sharing impossible, but the MVP must not absorb authentication/synchronization complexity merely for hypothetical future use.

All app users are expected to be instructors/assistant instructors who are already authorized to access course information. Still, context-sensitive UI should avoid displaying irrelevant personal data everywhere.

Example: phone number belongs in student detail, not in crew announcement views.

---

# 11. Voice behavior

Voice is an input method, not a content type.

Initial voice-enabled contexts:

- initial student note;
- boat fault;
- evaluation note.

Expected flow:

record → transcribe → show editable text → save text → discard audio.

Expected spoken language is **Italian**. Voice transcription should therefore use Italian as the default/expected language rather than relying on unconstrained language detection.

Provider/implementation is a technical decision and is not specified here.


## v0.4 — Resolved implementation rules

### Course and sessions
- Store the real course dates and also ISO week number + year.
- Sessions are identified only by day + `AM`/`PM`; no operational timestamps are needed for MVP.
- Session sequence is Saturday PM through Friday PM.

### Default boats
Use these operational defaults, even if public/older CVC material differs:
- D1 → RS Toura
- D2 → RS Quest
- D3 → RS Quest
- D4 → Laser Vago
- D5 → RS 500

Cabin courses are secondary for now. Working mapping:
- C1 → J/80
- C2 → First 25.7
- C3 → First 27
C4/C5 are outside the current practical scope.

### ADV / IS
For MVP store only:
- one name;
- role (`ADV` or `IS`).
No separate display-name field. Treat these people as belonging to the current course for now; cross-course reuse must not complicate MVP.

### Scan confidence
Confidence is per extracted field, not all-or-nothing per row. Keep a field only when extraction confidence is reasonably good; otherwise leave it empty for manual completion. A reliable name can therefore be kept even if DOB is missing, and vice versa. Human review before commit remains mandatory.

### Student compact display name
- unique first name → `Mario`;
- collision → first name + surname initial, e.g. `Mario R.`;
- manually entered nickname/display name overrides the generated form.

### Size warnings — 2-person crews
| Combination | Warning |
|---|---|
| XS + XS | Red |
| XS + S | Red |
| S + S | Red |
| XS + M | Yellow |
| S + M | None |
| M + M | None |
| M + L | None |
| M + XL | None |
| L + L | Yellow |
| L + XL | Red |
| XL + XL | Red |

Order is irrelevant. Do not infer additional size warnings beyond this table for MVP.

### Crew repetition
For 2-person crews:
- same pair in any of previous 3 sessions → Red;
- same pair earlier in course, but not previous 3 sessions → Yellow;
- never together → no repetition warning.

For crews of 3+:
- entire crew identical to any previous crew → Red;
- also evaluate every internal pair;
- internal pair repeated in previous 3 sessions → Red;
- older internal-pair repetition → Yellow.

Do not implement fuzzy crew similarity.

### MVP architecture
Future extensibility must not materially increase MVP complexity. Prefer less code when solutions satisfy the same current requirement: shallow purposeful folders, short files, explicit functions, few dependencies, minimal abstractions, and comments only where they add useful intent.


## v0.5 — Lifecycle, Comandate, Valutazioni and read mode decisions

### Course lifecycle
`Concludi corso` is potentially useful but is not required for the first MVP.

Do not implement locking/read-only/reopen mechanics initially. Previous courses may remain editable. Historical-course browsing is low priority.

### Export
A simple technical export/import path may be useful relatively early for testing, creating fictitious runs, and exercising business rules.

Presentation exports are post-MVP features to remember:
- export/share an image of Equipaggi;
- export/share an image of Comandate.

These should not complicate the initial implementation.

### Automatic Comandate distribution
The automatic generator proposes the most even possible distribution.

At the start of the week:
- distribute all relevant students across the 7 duty rotations.

When recalculating later:
- consider active/relevant students who still need a normal duty;
- divide them across the remaining duty days only;
- completed duty rotations remain immutable history.

If division has a remainder, distribute the extra students as evenly as possible. Example: 23 students over 7 days results in days of 3 and days of 4.

This is a proposal, never a constraint. After generation, every day remains freely editable. The instructor may intentionally create highly unbalanced or unusual distributions, including days with zero students or many students. The app may warn but must not block the edit.

All existing higher-priority assignment rules (Friday stay-over preference, minor balancing, optional sex balancing, tie-breaker) apply while producing the even proposal.

### Comandate warning acknowledgement
- Red/major warnings remain visible even if the instructor intentionally accepts the situation.
- Yellow/minor warnings may be acknowledged/accepted and then hidden for that unchanged situation.

### Automatic correction
Do not implement per-problem automatic fixes such as `Sistema questo problema`.

The only automatic corrective operation is:

`Ricalcola comandate rimanenti`

It preserves completed rotations and regenerates only the remaining plan using current students/state/rules. Manual editing remains unrestricted afterward.

### A terra in Valutazioni
Students marked `A terra` for a session still appear in that session's evaluation screen.

Default:
- evaluation remains `—` / missing;
- show a small visual reminder that the student was `A terra`.

The instructor may still assign an evaluation manually if appropriate.

### Evaluation notes in Riepilogo
A mark that has an associated note should have a discreet visual indicator (for example an asterisk or note icon).

Tapping the relevant mark/student should make the associated note easy to read without navigating through multiple screens.

### Mobile crew assignment interaction
Primary composition interaction is:

**tap person → tap destination crew**

Do not make drag-and-drop the primary interaction. Optimize for fast, reliable one-handed phone use and minimal implementation complexity.

### Equipaggi read / announcement mode
Provide a dedicated, extremely clean view for reading crews aloud.

It must support all of these states:
- exact boat assigned: `Quest 7 — Mario / Luca`;
- boat type known but no number: `Quest — Mario / Luca`;
- no boat assigned yet: `Mario / Luca`.

Boat assignment is therefore never required to use announcement mode.

The read view should avoid editing controls and nonessential decision-support information.

### Outdoor readability
If straightforward in the target PWA/browser, offer a control that keeps the screen awake while announcement/read mode is open.

Increasing screen brightness would also be useful outdoors, but treat it as best-effort/post-MVP if browser/platform restrictions make it non-trivial. Do not add native complexity merely to control brightness.

## v0.7 — Navigation, boats, crew interaction and student detail

### Primary navigation
Use a hybrid navigation model.

Persistent bottom navigation has exactly three primary destinations:

`Avarie` · `Home` · `Equipaggi`

`Home` is central and visually primary.

The Home page contains the functional cards:
- Allievi
- Barche
- Comandate
- Equipaggi
- Valutazioni
- Volontari

`Volontari` is intentionally lightweight: current-course people with name and role (`ADV` or `IS`) only.

Future cards/areas such as course notes, documents, teaching PDFs/images, base schedules and other reference material are post-MVP. The Home card layout should make adding another card trivial, but do not build generalized content infrastructure in the MVP.

### Home visual identity
The Home page should have some visual identity, for example:
- course label such as `D2`;
- current week such as `Settimana 35`;
- year where useful;
- CVC/Caprera logo/branding if available;
- visual inspiration from the current CVC website, especially colors and general graphic language.

Do not turn Home into an operational dashboard in the MVP. Counts, alerts, duty reminders and similar dashboard widgets are optional future polish.

### Boat number entry
Typing boat numbers during initial course setup is acceptable because it is a rare operation. Do not build a complex boat-number picker solely to avoid this one-time typing step.

### Boat lifecycle and availability
Distinguish clearly between:
- **Delete**: remove an incorrectly entered boat entirely.
- **Available**: normal active boat.
- **Unavailable**: keep boat/history but grey it out and do not normally propose it for new sailing assignments.

Fault status and availability are separate concepts. A boat may have an open fault and still be usable.

If a boat already assigned to a crew/session later becomes unavailable, show a **red warning**. Do not automatically change or clear the assignment.

### Crew composition interaction
In `Equipaggi`, optimize tap for composition rather than detail navigation.

Primary interaction:
1. tap a student/person to select them;
2. selected cell/card changes appearance slightly so the current selection is unmistakable;
3. tap a free slot/crew to move the selected person there;
4. tap another assigned person to swap the two people directly.

No confirmation popup for move/swap. If the instructor makes a mistake, they can immediately correct it.

A **long press** on a student in Equipaggi opens that student's detail.

In `Gestione Allievi`, normal tap on a student opens their detail directly.

### Copy previous crews
`Copia equipaggi sessione precedente` should intelligently adapt the copied structure to the current session.

Remove or relocate people whose current state makes the previous assignment invalid, for example:
- current duty/comandata;
- `A terra`;
- disabled/inactive;
- other explicit current-session unavailability.

Do not try to automatically rebuild a complete optimal crew composition. Preserve the useful previous structure, create visible gaps where needed, and let the instructor finish manually.

If one or more people were removed/relocated automatically, show a small informational popup **after** the copy has already happened:

`Equipaggi copiati`

`Rimossi:`
- `Mario Rossi — comandata`
- `Luca Bianchi — A terra`
- `Anna Verdi — non disponibile`

This is not a confirmation dialog. If no automatic removals/changes occurred, do not show the popup.

### Student notes
Keep these concepts distinct:
1. **Initial note** created during `Conoscenza allievi`.
2. **Course/week note**: optional general note updated during the week from student management; useful but lower priority.
3. **Evaluation note**: attached to one specific student evaluation in one specific session.

All of these must be visible from the student's profile/detail.

### Student detail as complete history
The student detail is the canonical place to reconstruct the useful history of that student.

It should expose:
- personal/course fields;
- size;
- initial note;
- optional course/week note;
- chronological evaluation history;
- notes attached to individual evaluations.

From the evaluations Overview/Riepilogo, tapping a student's name opens this detailed view, preferably focused on the evaluation-history area.

### Evaluation-history layout
Do not hard-code a specific table geometry.

Requirement:
**Show the complete chronological evaluation history, preserving session identity and associated notes, using the most readable mobile layout.**

The UI may use:
- a compact AM/PM grid if it fits well; or
- a vertical chronological list if that is clearer on mobile.

The Overview itself should prioritize trend and compactness. No visible numeric score/mean. A chronological symbol sequence is sufficient even if exact day/session headers are omitted there. Detailed session identity belongs in the student detail.

### Evaluation summary
A compact row may resemble:

`Mario R.   =  +  +*  ++  —  +  =  -    7 voti`

where:
- `*` or a note icon indicates an associated note;
- `—` means missing/not evaluated;
- the visible evaluation count remains useful;
- no numeric score is shown to the user.

Internal numeric mapping may still be used for ordering if needed, but must remain implementation detail.

## v0.7 — Final MVP interaction clarifications

### Equipaggi: pool and slots
The composition screen separates a pool of currently available students, a separate Staff/Volontari pool, and the crew cards/slots. When a person is assigned, remove them from the available pool and show them in the crew slot. Removing them returns them to the appropriate pool. This keeps unassigned people immediately visible and avoids duplicates.

### Person placement vs crew destination
These are different concepts.

Individual people may be:
- available/unassigned;
- assigned to a crew;
- `A terra`.

A crew destination may be:
- `Non assegnato` (default);
- one specific sailing boat;
- `Mezzi`.

`Mezzi` means generic motor/support craft (e.g. gommone/lancione/gozzo); individual motor craft do not need to be modeled in MVP.

**`A terra` is never a crew destination.**

### Destination interaction
Use tap crew → tap sailing boat/`Mezzi`. Reassignment uses the same interaction. A sailing boat can belong to only one crew in a session; prevent duplicate simultaneous assignment.

### Copy previous crews
`Copia equipaggi sessione precedente` is a secondary, non-dominant option. It is useful but expected to be used rarely.

### Disabled students
Disabled students disappear from operational pools and cannot receive new assignments, but remain in historical crews/evaluations and in Gestione Allievi/detail. Re-enabling restores future availability without changing history.

### No generic Undo
Do not add an Undo system. Normal edits are directly reversible using the same interactions; avoid UI and state-management clutter.

### Field-use UX is a functional requirement
The app is used while hurried, tired, outdoors, near/on the water and sometimes aboard support craft. Therefore minimize typing, use reliable touch targets, show only contextual information, avoid unnecessary confirmations, autosave routine edits, preserve manual control, and use warnings rather than rigid workflows.

### Local persistence
MVP data must survive app/browser closure and reopening. Future multi-device synchronization is expected, but do not introduce speculative backend/sync architecture into MVP.

---

## Domain and business rules

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
