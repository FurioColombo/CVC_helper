# G4 field-UX review

Verdict: **PASS_WITH_FINDINGS**

## Blockers

None.

## Important findings

None. Final re-review confirmed modal semantics, initial focus, Tab
containment, Escape handling and focus restoration for all three crew dialogs.
The graphical crew-limit note is concise, visually distinct and dynamically
accurate.

## QoL findings

- Warning and contextual destination controls remain 40 px; 44–48 px would be
  more forgiving outdoors.
- Destination choices use an unhinted horizontal scroller, so later boats or
  `Mezzi` may be overlooked.
- The optional screen-wake control remains absent, as documented.

## Evidence inspected

- Current crew UI and dialog behavior tests.
- Empty/populated crew-limit states.
- Holistic G4 browser journey.
- Viewport-only iPhone announcement screenshot.
