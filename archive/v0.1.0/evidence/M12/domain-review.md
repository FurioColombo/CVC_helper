# M12 adversarial domain review

Verdict: **PASS_WITH_FINDINGS**

## Blockers

None.

## Important findings

None remain in the implemented M12 behavior or required evidence. The first
browser journey could not disprove an accidental student-only persistence key;
it now keeps distinct values (`+` and `--`), reloads, checks both sessions
independently, and waits for the visible per-student save confirmation.

An orphan evaluation whose student no longer exists is hidden by the
course-scoped student join. Foreign-course writes are rejected, and invalid,
duplicate, or session-mismatched rows returned for the current course fail the
read. A full persisted-state orphan scan remains integrity hardening outside
this milestone.

## QoL findings

Real microphone and local-model behavior remains assigned to M14 device
validation. M12 verifies the deterministic capability boundary: audio is
transcribed locally into an editable draft, the stream is stopped, and only
confirmed text reaches persistence.

## Evidence inspected

- Authoritative M12 evaluation requirements and scope boundaries.
- Canonical evaluation mapping and domain aggregation/default-session tests.
- Course/session-scoped evaluation persistence and corruption guards.
- Shared Allievi/Equipaggi state, A-terra reminder and evaluability, editable
  past sessions, note workflow, rollback, and voice draft behavior.
- Browser journey on Pixel 7 and iPhone 13, including reload and distinct
  cross-session values.
- Focused reviewer re-verification: 3 files and 23 tests passed.
- Official verification: 28 files and 225 tests, domain checks, production
  build, and 30 browser journeys passed.
