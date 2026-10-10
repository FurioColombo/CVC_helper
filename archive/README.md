# Archive

Frozen history (`docs/DOCS_SYSTEM.md`): read it only when someone asks why, or
for a specific dependency of active work. Nothing here is authoritative, and
nothing here is edited or deleted.

| Folder or file                       | What it holds                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `v0.7_design_history/`               | The design documents before the MVP plan.                                     |
| `v0.8_working_set/`                  | The working set that became the MVP specification.                            |
| `v0.1.0/`                            | The 0.1.0 plan and its milestone evidence (M0–M15, G1–G5).                    |
| `v0.2.0-design-history/`             | The 0.2.0 change requests, reviews and questions.                             |
| `v0.3.0-through-R1/`                 | The 0.3.0 plan and contract as they stood through R1.                         |
| `v0.3.0-completed-milestones.md`     | The closed 0.3.0 milestone sections.                                          |
| `v0.3.0-s4-measurement-history.md`   | S4's OCR measurements and rejected variants.                                  |
| `v0.3.0/`                            | The 0.3.0 plan at release, the scope before the 0.4.0 rewrite, the owner brief, questions, open items, audit and next steps. |

From 0.4.0, each released cycle gets one folder, `v<version>/`, holding its plan
and folded working documents.

## The one exception

Personal data found in a frozen file (here, in `CHANGELOG.md` or a completed
milestone's evidence) is removed with the owner's approval. Each removal adds
one entry below, in the same commit as the edit: a dash, the date, and the
file's path in backticks. `check:docs` lets through only the edit whose entry
is new in that commit.
