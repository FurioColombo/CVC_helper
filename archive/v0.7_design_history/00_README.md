# CVC Caprera Assistant — Codex Documentation Pack

Status: **UX-first draft / pre-implementation**

This pack is intentionally written for both humans and coding agents. It separates:
- what the user should experience;
- what behavior is required;
- what is still undecided;
- how Codex should eventually execute the implementation.

## Read order

1. `01_UX_SPEC.md`
2. `02_DOMAIN_AND_RULES.md`
3. `03_MVP_SCOPE.md`
4. `04_OPEN_QUESTIONS.md`
5. `05_CODEX_WORKING_RULES.md`
6. `06_IMPLEMENTATION_PLAN_DRAFT.md`

## Important status rule

Anything explicitly marked **OPEN**, **TBD**, or **DRAFT** must not be silently invented by Codex.

The UX specification is currently the primary source of truth. Technical architecture and the detailed implementation plan are deliberately incomplete until the open product questions are resolved.

## Product philosophy

Build the smallest useful product first.

The target is a proof of concept that can become genuinely useful after roughly 2–3 days of focused development. Prefer simple, explicit, replaceable code over robustness or abstraction that is not yet required.

The long-term product should support sharing, but the first useful version may be single-device and local-first.


Documentation pack version: **v0.7**
