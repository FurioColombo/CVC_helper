# M13 self-review

Verdict: **PASS**

## Blockers

None.

## Findings

None. The compact course sequence exposes a visible abbreviated session label
for every slot, retains missing marks, shows only the count of actual marks,
and never renders the internal numeric mean. Notes open inline from their exact
mark, while the student link opens chronological, session-labelled history and
returns to the same Riepilogo view.

## Evidence inspected

- Table-driven aggregate, ordering, tie and accumulated-session tests.
- Course-wide and exact-student persistence reads and corruption guards.
- Riepilogo component tests for alphabetical/strongest ordering, actual-mark
  counts, missing exclusion, discreet note marker and no numeric mean.
- Student-detail history component tests for exact session, symbol and note.
- Pixel 7 and iPhone 13 browser journey through entry, ordering, note, student
  detail, history, and return navigation.
- iPhone screenshot at `.evidence/M13/evaluation-overview-iphone13.png`.
