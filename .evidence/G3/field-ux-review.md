# G3 field/mobile UX review

## Verdict

PASS

## Blockers

None.

## Important findings

- The 21-student overview remains compact and readable at 390 x 844; canonical
  day order, names, counts, completion state and zero-warning status are clear.
- Primary actions and day/student controls meet phone touch-target needs.
- `Segna completata` is immediately above the roster and exposes pending/error
  state.
- Completed/read-only days show only assigned students at full contrast, or a
  clear empty-history message.
- Advisory acknowledgement prevents duplicate input and reports persistence
  failures without hiding the warning.
- The refreshed Pixel 7 and iPhone 13 journey passes 2/2 with no bottom-nav
  obstruction.

## QoL findings

- Recalculation confirmation follows the potentially long stay-over list. A
  sticky confirmation could be future polish but does not block G3.
- Native WebKit remains reserved for M14.

## Evidence inspected

- Current DutyManagement UI and three new component regressions.
- Updated realistic 21-student browser journey.
- `.evidence/G3/duties-gate-iphone13.png` at the iPhone 13 viewport.
- Official G3 verification and `git diff --check`: PASS.
