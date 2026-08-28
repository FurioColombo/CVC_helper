# Open Questions — current after v0.7

The MVP product specification is sufficiently closed to begin implementation.

The historical question log below is design history, **not an implementation backlog**. Do not reopen resolved questions unless current requirements genuinely conflict or a missing choice would materially change user-visible behavior/data.

Important final correction:
- `A terra` = individual-person placement/status.
- `Mezzi` = crew destination.
- `A terra` must never be offered as a crew destination.

Minor geometry, spacing and component choices should be decided pragmatically from the UX principles.

---

## Historical question log

# Open Questions — current after v0.6

This file contains historical question batches below. For implementation, treat the following as **resolved** and do not reopen unless a conflict appears:

- navigation = bottom `Avarie / Home / Equipaggi` + Home cards;
- Home includes `Volontari`;
- Home visual identity uses course/week + CVC-inspired branding, not an MVP dashboard;
- boat numbers may be typed during setup;
- boat `Delete` and `Unavailable` are separate;
- fault state and availability state are separate;
- assigned boat becoming unavailable = red warning, no automatic reassignment;
- Equipaggi tap selects/moves/swaps; long press opens student detail;
- selection is shown through a slight cell/card visual change;
- copied crews are adapted to current state and automatic removals are summarized after copy;
- initial note, course/week note and evaluation note are separate concepts;
- all student notes/history are visible from student detail;
- Overview tap on student opens detailed evaluation history;
- Overview shows chronological trend and count, with no visible numeric score;
- detailed evaluation history preserves session identity and notes using whichever mobile layout is clearest.

Only questions not contradicted by resolved v0.4–v0.6 decisions should be considered genuinely open.


---

## Historical question log

These questions should be answered before or during the next specification pass. They are grouped by how much they can affect implementation.

## A. High priority — resolve before architecture is frozen

1. **Course dates**
   - Is ISO week + year always sufficient?
   - Should the course explicitly store its start Saturday and end Saturday dates?
   - Can a course ever start outside the normal Saturday-to-Saturday pattern?

2. **Deriva/Cabinato and levels**
   - Are levels 1–5 valid for both families?
   - What are the exact abbreviations for cabinato course labels?
   - Are there special course types that should already exist in the data model even if hidden from MVP UI?

3. **Default boat mapping**
   - Exact default mapping from course type/level to boat model.
   - Confirm names/spelling for all boat types that should appear in dropdowns.
   - Should users be able to add an arbitrary/custom boat type?

4. **Session schedule**
   - Exact list of sailing sessions that should exist automatically.
   - Is Saturday morning always absent and Saturday afternoon always present?
   - Is Friday afternoon always the final evaluated sailing session?
   - Should session timestamps be stored or only day + morning/afternoon?

5. **Staff**
   - Where should instructors/assistant instructors be registered?
   - What minimum fields are needed: name only, role, nickname?
   - Are staff course-specific or reusable across weeks?

6. **Local persistence and sharing**
   - Is MVP-0 allowed to be fully local with no login?
   - When read-only sharing is added, which information should be exposed by default?
   - Is a shared link sufficient, or should viewers authenticate?

## B. Student import and data

7. What does a typical printed/screenshot student sheet look like? Supplying 2–5 real anonymized examples would materially improve the scan design.

8. Which extracted fields are mandatory before an imported student can be confirmed?
   - name?
   - surname?
   - date of birth?
   - phone?

9. If date of birth cannot be read, may the student be saved with unknown age/minor status?

10. Should age/minor status be calculated relative to today's date or course start date? Course start date is probably more stable.

11. For inferred sex, are the stored values strictly `M/F` for this operational use case, and should an unknown/unset state exist?

12. Should display name be auto-generated? If yes, desired rule:
   - first name;
   - first name + surname initial when duplicates exist;
   - manual nickname overrides both?

13. When disabling a student, should the UI optionally record a reason, or is that unnecessary for MVP?

## C. Conoscenza allievi

14. Confirm final UI label: `Conoscenza allievi`, `Informazioni allievi`, or another name.

15. Does every student need an XS–XL size, or may it remain unknown?

16. Is there any structured prior-experience value in addition to free text, or should MVP keep only the note?

## D. Comandate

17. What is the exact default headcount per duty? Is it derived only from student count / seven, or are there course-specific norms?

18. When the division is uneven, should the app merely ask which days receive fewer/more students, or should it suggest preferred days?

19. For students staying the following week:
   - should Friday preference be enabled by default?
   - if more candidates exist than Friday capacity, what is the next tie-breaker?

20. If an anomaly such as “student has two duties” is explicitly accepted, how long does that acceptance last?
   - until assignment changes;
   - until user re-runs validation;
   - entire course?

21. Should automatic fixing operate per warning or also offer `Fix all`?

## E. Equipaggi — important before implementing warnings

22. Exact crew-size behavior for every course:
   - D1;
   - D2;
   - D3;
   - D4;
   - D5;
   - cabinato levels.

23. Clarify the example where crew count and boat count differ. What exactly is an “equipaggio” for D1 / variable-size courses?

24. Define size warning thresholds formally.
   - Which combinations are red?
   - Which are yellow?
   - Should the rule use a numeric mapping XS=1...XL=5 and total/mean thresholds?

25. Evaluation-band indicator during composition:
   - exactly top/bottom 30%?
   - based on mean evaluation?
   - minimum number of evaluations before showing `+/-`?
   - precise tie behavior.

26. Pair repetition:
   - immediate previous session = always red?
   - should “together N times” include the current draft?
   - how should crews larger than two be handled?

27. For a crew with 3+ students, should pair-history warnings be generated for every pair inside that crew?

28. Are staff included in pair-history warnings, or should pair statistics be student-to-student only?

29. `Mezzi`:
   - is there only one generic `Mezzi` destination?
   - should exact support craft ever be represented later?

30. Boat assignment:
   - can two crews be associated with the same sailing boat because of planned rotations?
   - or is exact boat assignment one crew → one boat at any instant?

31. Quick edit:
   - preferred interaction: tap-and-select, drag-and-drop, or both?
   - Drag-and-drop can be awkward on mobile; this should be decided deliberately.

## F. Evaluations

32. Should `--`, `-`, `=`, `+`, `++` be displayed as five always-visible buttons per student, or via a compact tap control?

33. Should notes be visible from the evaluation list when present, e.g. a small note icon?

34. Should `A terra` students appear in that session's evaluation list?
   - probably yes but default unassessed;
   - confirm.

35. Should staff never appear in Valutazioni? Assumed yes.

36. Overview sorting:
   - what happens to students with zero evaluations?
   - alphabetical at bottom?
   - separate “not enough data” group?

37. Should the Overview expose session notes when tapping an evaluation symbol?

## G. Navigation / visual design

38. Preferred navigation pattern:
   - home tiles + back navigation;
   - bottom navigation;
   - hamburger/side menu;
   - hybrid?

39. Should the app prioritize one-handed use?

40. Any Caprera visual identity constraints: logo, colors, typography, or should MVP remain neutral?

41. Is dark mode useful for early-morning/evening use, or explicitly unnecessary for MVP?

42. Should the “read crews aloud” view prevent screen sleep or increase text size?

## H. Data lifecycle

43. What happens Saturday when the week ends?
   - archive course;
   - export;
   - create next course;
   - overwrite/reset?

44. Should old courses remain locally browsable?

45. Is export desirable early (JSON/CSV/PDF), especially before cloud sharing exists?

46. Is there any requirement to delete course/student data after a certain period?

## I. Voice and scan

47. Is internet connectivity acceptable for initial transcription/OCR, or must either feature work offline?

48. Preferred language assumptions:
   - Italian-only voice;
   - Italian UI;
   - names may be international.

49. Should voice transcription automatically insert punctuation/clean filler words, or preserve transcription closely?

50. For scan extraction, is an LLM/vision extraction service acceptable for MVP if it is more robust to variable layouts than classical OCR?

---

## Suggested next discussion order

1. Answer only the high-priority questions that affect the data model.
2. Formalize crew-size and warning rules.
3. Resolve navigation.
4. Resolve data lifecycle.
5. Only then freeze technical architecture and produce the detailed Codex task plan.


## Questions resolved in v0.4

The following previously open topics are now closed and should not be treated as blockers:
- real course dates vs ISO week/year → store both;
- session timestamps → day + AM/PM is sufficient;
- D1–D5 default boat mapping → fixed in UX spec;
- ADV/IS minimum fields → name + role;
- partial/uncertain scan extraction → confidence handled per field;
- compact display-name rule → defined;
- D2–D5 crew size → 2;
- two-person size-warning matrix → defined;
- crew repetition warning horizon → previous 3 sessions red, older repetition yellow;
- first MVP architecture → local-first and deliberately minimal.

Codex should not silently re-open these decisions unless a later requirement explicitly conflicts with them.


## Questions resolved in v0.5

The following are now resolved:
- old courses do not need locking/read-only mechanics in the first MVP;
- technical export/import is useful mainly for testing; polished crew/duty image export is later;
- Comandate headcount is automatically balanced from remaining students / remaining days, including remainder distribution;
- generated Comandate remain fully manually editable;
- accepted red warnings remain visible; accepted yellow warnings may be hidden;
- no local automatic `fix this` action; only `Ricalcola comandate rimanenti`;
- `A terra` students remain in Valutazioni with missing mark by default and a contextual indicator;
- marks with notes are indicated in Riepilogo and notes are quickly accessible;
- crew composition interaction is tap person → tap crew;
- announcement mode is a separate clean view and must work without boat assignment;
- wake lock is desirable when straightforward; brightness control must not create MVP complexity.
