# MVP Scope

## Objective

Produce a small, genuinely usable proof of concept rapidly.

The first useful build should favor:
- simple code;
- few dependencies;
- direct workflows;
- local usability;
- easy replacement/refactoring later.

## MVP-0 candidate

### Include

1. Create one course.
2. Add students manually.
3. Scan/import students with human review if feasible without destabilizing the first build.
4. Student list/detail and disable/re-enable.
5. `Conoscenza allievi`: size + optional note.
6. Configure boats.
7. Boat list/detail.
8. Add/update/resolve faults.
9. Configure duties manually.
10. Automatic duty proposal with simple deterministic rules.
11. Duty validation and manual override.
12. Manual crew composition.
13. `A terra` and `Mezzi`.
14. Basic crew warning system.
15. Fast crew read/announcement view.
16. Evaluations by session.
17. Evaluation Overview/Riepilogo.
18. Local persistence.
19. Mobile-first PWA behavior.

### Prefer to include shortly after core flow works

- voice transcription;
- robust image extraction from variable sheet layouts;
- richer crew history information;
- read-only sharing.

### Explicitly defer unless implementation proves trivial

- collaborative multi-user editing;
- complex authentication/permissions;
- automatic crew optimization;
- sophisticated constraint solvers;
- detailed analytics;
- audit/version history;
- generalized workflow engine;
- cabinato-specific complexity not needed to validate the product.

## Development philosophy

A partially complete application that supports a real end-to-end workflow is preferred over many half-built subsystems.

Recommended vertical order:

course → students → boats/faults → duties → manual crews → evaluations → assisted input → sharing.

This ordering is provisional and must be reconciled with the detailed implementation plan before coding.


## Explicit post-MVP items added during UX review

- evaluation-band `+/-` indicators in Equipaggi;
- voice-based student-name entry (nice-to-have);
- full remaining-duty recomputation may be deferred if it materially increases MVP complexity.


## v0.4 MVP constraints

- Local-first remains acceptable for the first useful build.
- Do not add backend/auth/sync machinery only for hypothetical future sharing.
- Keep code intentionally small and inspectable.
- D2–D5 crews are fixed at 2 people.
- Cabin-course complexity is secondary; C4/C5 are outside current practical scope.
- Size and repetition warnings defined in UX spec are deterministic MVP rules.


## v0.5 scope clarifications

### Keep in / useful early
- Even automatic Comandate proposal.
- Midweek `Ricalcola comandate rimanenti`.
- Manual override after every automatic proposal.
- A-terra indicators in Valutazioni.
- Evaluation-note indicator/access from Riepilogo.
- Tap-person → tap-crew composition.
- Clean Equipaggi announcement/read mode.
- Screen wake lock in read mode if straightforward.
- Simple technical data export/import may be added early when useful for testing.

### Defer / low priority
- Course locking/read-only/reopen lifecycle.
- Rich historical-course management.
- Image export of Equipaggi.
- Image export of Comandate.
- Screen-brightness control if it requires platform-specific/native complexity.
- Per-warning automatic repair.

## v0.6 scope clarifications

### MVP navigation
Include:
- persistent bottom nav: Avarie / Home / Equipaggi;
- Home cards: Allievi, Barche, Comandate, Equipaggi, Valutazioni, Volontari.

Keep future Home cards easy to add, but do not create generic document/content systems.

### MVP boat management
Include:
- typed boat number entry during setup;
- delete mistaken boat;
- available/unavailable state;
- visual greying of unavailable boats;
- red warning if an already assigned boat becomes unavailable.

### MVP crew editing
Include:
- tap to select;
- visual selected state;
- tap destination to move;
- tap person to swap;
- long press student for detail;
- adapted copy from previous session;
- post-copy informational popup only when people were automatically removed/relocated.

### MVP evaluations/student detail
Include:
- initial note;
- session evaluation notes;
- complete evaluation history in student detail;
- note indicators from summary;
- compact chronological Overview without visible numeric score.

### Lower priority / can defer
- editable general course/week student note if schedule is tight;
- visual Home dashboard widgets;
- document/PDF/reference-material section;
- course/base schedule section.

## Final MVP boundary

MVP is complete when an instructor can, with persistent local data:
1. create/configure a course;
2. add/import/scan students and add ADV/IS volunteers;
3. perform Conoscenza allievi;
4. configure/manage boats and faults;
5. generate/edit/recalculate Comandate;
6. manually compose and verify crews;
7. place individual people A terra;
8. assign crews to a sailing boat, Mezzi, or leave destination unassigned;
9. use the clean announcement/read view;
10. record session evaluations/notes and inspect student trends/history;
11. close/reopen the app without losing course state;
12. use voice transcription in the specified note/fault contexts.

Post-MVP: multi-device sync/sharing, image exports, documents/reference materials, Home dashboard, automatic crew generation, rich course archive/locking, and native/platform brightness complexity.
