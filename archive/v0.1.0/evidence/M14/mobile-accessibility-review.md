# M14 mobile and accessibility review

## Verdict

PASS_WITH_FINDINGS

## Blockers

None. The earlier WebKit fault-save and crew long-press failures are resolved, and all eight real iPhone 13 WebKit core journeys pass.

## Important findings

- Top-level shell changes move focus to the new main region, and evaluation deep links move focus to the requested history. Some internal list-to-detail transitions do not yet announce a new heading automatically. This is useful future accessibility hardening, but it does not block the accessible routes or the milestone.

## Quality-of-life findings

- Long-press access to a student from crew composition is not visually discoverable; the ordinary Allievi route remains available.
- Evaluation timelines can scroll horizontally without a strong visual overflow cue.
- An evaluation-note draft is not preserved if the editor is left before saving.
- Native date presentation varies by device locale; the explicit `GG/MM/AAAA` hint reduces ambiguity.
- The permanent Home button remains visually stronger than the current Avarie or Equipaggi state.

## Evidence inspected

- M14 changes for shell focus, fault serialization, long-press handling, 44 px controls, birth-date guidance, student history focus, evaluation labels and PWA metadata.
- Focused component coverage for the changed interactions.
- Existing mobile screenshots from prior feature and integration milestones.
- Eight successful real iPhone 13 WebKit journeys: boats, crews, duties, evaluations, students, shell, reload persistence and close/reopen persistence.
- Final reported quick, domain and production PWA verification.
