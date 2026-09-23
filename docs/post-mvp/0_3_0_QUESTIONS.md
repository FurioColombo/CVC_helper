# Questions for the owner — 0.3.0

Updated 2026-09-23. The product instructions are sufficiently specific to
implement and test. The working decisions below prevent repeat questions.

| Topic                        | Working decision and evidence to check                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age entered without birthday | Treat it as completed years at the course start. Store the declared age and its provenance; do not fabricate a date. Minor rules use that age when DOB is absent. S5 tests birthday boundaries and old records.     |
| OCR target                   | Reproduce the owner's roughly 26 flags on the same ignored good photograph, with the same review counter and scan settings. Fewer than five is the target; zero is ideal. Do not reduce confidence 70 or hide text. |
| Crop look                    | Use a modest zoom that keeps the selected area readable, a darker softly blurred exterior and live rotation. Compare on phone-sized viewports and review rendered frames.                                           |
| Dictation control            | Preserve the present appearance if it fits. The fixed square was a suggestion, not a requirement. Independent design review still happens before code.                                                              |
| Crew summary image           | A full-page **download** satisfies “download OR copy”; add copy only if it proves reliable across target mobile browsers. All crews must fit without shrinking names into illegibility.                             |
| Three-person crew row        | Default to three; Settings offers two or three. The two-column choice is the user's fallback on smaller phones.                                                                                                     |
| PWA icon                     | Reuse the Home CVC symbol with white background and HELPER in CVC blue. The final product name remains undecided.                                                                                                   |

If testing reveals a genuinely blocking semantic choice, append one concise
question with the measured alternatives and complete independent work before
asking the owner once.

## New privacy decision

The five private photographs remain ignored and have no matching path in the
local Git history. A local remote-tracking copy of `main`, however, contains
real roster examples in tracked tests. The same examples occur in the local
remote-tracking `main` and `codex/0.3.0` refs and the released `v0.2.0` tag.
Replacing them in the current tree will not remove them from older public
commits. After the current-tree scrub is verified, should the repository
history and release tag be rewritten to remove those older examples? That would
require a coordinated force-push and fresh clones for collaborators. The
alternative is to keep history intact while ensuring future commits contain
only fictional examples. No history rewrite is authorized yet.
