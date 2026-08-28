# Codex Working Rules — Draft

This file is a precursor to the final repository `AGENTS.md`.

## Prime directive

Build the smallest implementation that satisfies the current approved specification.

Do not optimize for hypothetical future requirements.

## Source-of-truth order

Until revised:

1. explicit current task;
2. approved UX specification;
3. approved domain/rules document;
4. approved architecture document;
5. implementation plan;
6. reasonable local implementation judgment.

If two approved documents conflict, stop and report the conflict rather than silently choosing.

## Scope discipline

For each task:

- implement only the requested behavior;
- do not pre-build future milestones;
- do not introduce generic frameworks for one current use case;
- do not add dependencies without a concrete current need;
- do not redesign unrelated code while implementing a feature.

## Code style principles

- Prefer explicit code over abstraction.
- Prefer small modules with clear responsibilities.
- Keep business rules out of rendering components where practical.
- Centralize domain types rather than duplicating shapes.
- Keep persistence behind a small boundary so local storage can later be replaced/extended.
- Keep OCR and transcription behind small service boundaries.
- Avoid “enterprise” layering for the sake of layering.
- Avoid speculative plugin systems.
- Avoid large global state if local state is sufficient.
- Do not create a backend until an approved feature requires one.

## UX fidelity

Do not invent extra fields, confirmations, dashboards, warnings, workflow states, or mandatory steps.

Manual override is a product requirement.

Do not turn advisory rules into hard blocks unless explicitly specified.

## Incremental integrity

After each implementation task:

1. run relevant type checks;
2. run relevant tests;
3. run lint/format checks if configured;
4. manually verify the changed user flow when feasible;
5. leave the app runnable.

## Testing

Testing strategy may be pragmatic.

Prioritize tests for:
- deterministic business rules;
- validation;
- derived values;
- persistence boundaries;
- regressions in important workflows.

Do not spend MVP time creating exhaustive tests for trivial presentation components.

## Refactoring

Refactor when:
- a file becomes difficult to reason about;
- logic is duplicated;
- UI and business logic become tangled;
- a new requirement clearly exposes a bad boundary.

Do not refactor solely to introduce a fashionable pattern.

## Open questions

Never silently resolve a question marked OPEN/TBD in the specifications if the answer changes product behavior.

Prefer a minimal placeholder only when the implementation plan explicitly permits it.


## Explicit code-size rule — v0.4

Simplicity is a project requirement.
- Prefer less code when two solutions meet the same current need.
- Keep folders shallow and purposeful.
- Keep files short and easy to inspect.
- Prefer explicit functions over framework machinery.
- Avoid speculative repositories, factories, providers, generalized engines, plugin systems, or backend abstractions.
- Future-facing abstraction is acceptable only when it costs almost nothing now.
- Comment non-obvious intent/domain rules, not obvious syntax.


## UX implementation constraint — v0.5

When a browser/PWA capability is platform-dependent (for example wake lock or brightness), use it only if it can be implemented simply and progressively. Do not introduce native wrappers, complex permission flows, or architectural layers merely to support a convenience feature.

Automatic proposals must remain editable. Never convert a recommendation, balancing rule, or warning into a hard UI lock unless the UX specification explicitly says so.

## Interaction rules — v0.6

Prefer the fastest common mobile action for normal tap.

In Equipaggi:
- tap is for selection/composition;
- long press is for student detail;
- selected state must be visually obvious;
- move/swap operations happen immediately without confirmation dialogs.

Use informational popups only when they explain an automatic change that has already occurred and that the instructor should understand. Do not add confirmation friction to routine editing.

Do not force a specific evaluation-history grid if a simpler mobile list is clearer. Preserve the semantics (chronology, session identity, notes) and choose the simplest readable representation.

## MVP execution rules — v0.7

The specification is sufficiently closed. Prefer implementing and validating defined behavior over asking further product questions.

Autosave normal incremental edits. Explicit batch confirmation is reserved for reviewed student scan/import and initial course setup.

Do not invent future-sync abstractions. Keep domain data reasonably separable from rendering, but use the simplest local persistent implementation suitable for the MVP.

Never model `A terra` as a crew destination. Never model `Mezzi` as people.
