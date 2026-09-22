# Questions for the owner — 0.3.0

Updated 2026-09-23. **No blocking question at present.** The new instructions
are sufficiently specific to implement and test. The working decisions below
are recorded so a later agent does not spend a turn asking for answers already
implicit in the request.

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
