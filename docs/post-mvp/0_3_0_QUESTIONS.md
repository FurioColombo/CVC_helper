# Owner decisions and open questions — 0.3.0

Updated 2026-09-23 from the owner's answers in this file. These decisions
supersede the earlier working assumptions where they differ.

| Topic                         | Owner decision                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Age without an exact birthday | It is completed years on the **first day of the course**. The operator can correct the age manually. S5 stores its provenance and never invents a birthday.                                                                                |
| OCR acceptance                | The remaining **fewer than five** target on the good photograph moves to the final Claude Code follow-up and does not block V04–UG2 or the 0.3.0 gate. S4 stays open; no lower threshold, hidden wrong name or discarded text is approved. |
| Crop appearance               | Confirmed: a modest readable zoom inside the crop, darker subtly blurred exterior and fluid rotation. V04 verifies on phone-sized viewports.                                                                                               |
| Dictation control             | The responsive V02 appearance is acceptable; no fixed square is required.                                                                                                                                                                  |
| Crew summary sharing          | If a **Copy** action is offered, it must copy the complete summary **image**, never plain text. Download remains an image export.                                                                                                          |
| Crew capacity                 | D1 and Cabinato crews start at four and permit manual changes. D2–D5 stay fixed at two by default; a Settings-only flag enables add/remove students on crew cards. Capacity is separate from screen columns.                               |
| Selected-name display         | Keep the separate two/three names-per-row choice **only in Settings**; do not add this control to the Equipaggi page.                                                                                                                      |
| PWA icon                      | Working design remains the Home CVC symbol on white with blue `HELPER`; the final product name remains undecided.                                                                                                                          |

The owner confirmed the two/three-name **display** setting remains and that a
separate Settings flag may override the default two-person D2–D5 crew limit.
The crew-card add/remove controls are in C1 for that override and for manually
adjustable D1/Cabinato crews. No open C1 question remains.

## Privacy work deferred by the owner

The five private photographs remain ignored and have no matching path or exact
JPEG blob in local Git objects. A local audit found roster-value matches in 61
historical text blob versions across 24 paths; that count includes the owner's
name inside archived path logs. Current tracked examples are fictionalized,
but older refs and the `v0.2.0` tag retain earlier text. The owner placed any
coordinated history/tag rewrite in **future todos** and did not authorize it
for this cycle. Do not force-push or rewrite history now. See
`.evidence/S4/privacy-audit.json` for aggregate audit counts.
