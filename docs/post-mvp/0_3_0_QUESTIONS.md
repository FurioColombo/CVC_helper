# Owner decisions and open questions — 0.3.0

Updated 2026-09-27. The newest decisions and the questions still open are
first; the 2026-09-23 decisions follow. Later decisions supersede earlier ones
where they differ. The plan toward a shared database and 1.0.0 is in
[`1_0_0_NEXT_STEPS.md`](1_0_0_NEXT_STEPS.md).

## Decisions of 2026-09-26

| Topic                        | Owner decision and what was done                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Git history           | **Rewrite it.** Rewritten on a fresh mirror immediately before the first 0.3.0 push: real students' and staff names, birth dates and telephone numbers replaced by invented values in every commit and message of `main`, `codex/0.3.0`, `codex/post-mvp-ux-planning` and the `v0.2.0` tag. Results, aggregate counts only, are in `.evidence/F1/history-rewrite.json`. The current files were already clean and do not change. |
| New course                   | **Add it, in Settings.** `Elimina il corso e inizia un nuovo corso` erases the course from the device after a confirmation, then opens course creation.                                                                                                                                                                                                                                                                         |
| Volunteers and crew warnings | **Volunteers do not count** toward size or repeat warnings. The code already counted students only; a test now proves it.                                                                                                                                                                                                                                                                                                       |
| V05 assistant path           | **Stays in 0.3.0**, beside the camera path.                                                                                                                                                                                                                                                                                                                                                                                     |
| Surname particles            | Keep **Lo, Li, El, Al, De, Di** with the surname. Done and tested.                                                                                                                                                                                                                                                                                                                                                              |

## Open questions for the owner

1. **After the history rewrite (owner actions).** GitHub can still serve the
   old commits by their old ids until it purges them: please ask GitHub
   Support to purge cached views and unreferenced objects for
   `FurioColombo/CVC_helper` (their "remove sensitive data" process), and
   delete the Actions runs and artifacts of commits before the rewrite. Every
   copy of the repository made before the rewrite still holds the old history:
   the other agent's worktree `.codex/worktrees/ux1-pages-promotion` (checked
   out at an old commit), its `refs/codex/*` entries, and any clone on
   another computer. **Delete the Codex worktree and `refs/codex/*` before the
   next Codex session**, and delete or re-clone any other old copy; never push
   or pull-merge from one, or the old history would be published again. Right
   after the push, Claude Code points this computer's main checkout (`main`,
   `codex/0.3.0`, `codex/post-mvp-ux-planning` and the `v0.2.0` tag) at the
   rewritten history and deletes its own branches and worktrees; the Codex
   worktree and `refs/codex/*` are yours to remove. The protections exist
   only in copies that hold the rewritten history: there, `AGENTS.md` §13
   forbids working from an old copy, and `npm run check:repository` (part of
   `npm run verify` and `verify:all`) fails if old commits are merged back
   in. A copy that has not fetched the rewrite has neither, so an agent
   working in it is not warned. CI runs the same check, but only after a
   push, so it reports an old history that was pushed; it cannot prevent the
   push.
2. **Rows from an assistant (V05).** Every pasted row currently needs its own
   `Controlla` tap before saving, because an assistant can invent or misread a
   student and reports no confidence. With 40 students that is 40 taps. Keep
   it, or allow one "all checked against the sheet" confirmation?
3. **A boat's unresolved fault as a crew warning.** The crew page warns about an
   unavailable boat but not about a boat with an open fault, although tested
   helpers for that exist. Should an open fault show as a yellow crew warning?
4. **Erasing the course.** Rows are deleted in one transaction and the database
   is compacted where the browser storage allows. On a browser that cannot
   compact, deleted rows may linger in unused database pages until they are
   overwritten. For a guaranteed wipe of a device, clearing the site's data in
   the browser settings remains the strongest option. Is that acceptable, or
   should the app offer a full local reset as well?
5. **Duplicate check on the camera path.** To close a review finding, the scan
   review now flags a row whose name and birth date (or age) match another row
   or a student already in the course, until **Tieni entrambi** or removal.
   That adds a step to the camera path as well as the assistant path. Keep it
   for both, or only for pasted rows?
6. **Physical checks for UG2.** Only you can run them: speech on iPhone, camera
   scan time on your phone, the installed app offline, phone Back in every
   area, the update banner, and the assistant path with the assistant the
   centre will use. The checklist is `UG1_DEVICE_VALIDATION.md`.
7. **Staff headings on a scanned sheet (decided in F1, tell us if you
   disagree).** A staff heading such as `Personale` or `Istruttori` used to
   drop every row after it. Five review rounds showed that labels, blank
   form fields and names split by the scan made that drop silently lose
   students, so no staff heading drops rows any more: the rows after it are
   kept and marked `Forse personale` until a student heading. Staff rows that
   carry a role code (IS, ADV, CT …), as on your sheets, are still left out
   automatically, and your five photos read exactly as before. Staff printed
   without a role code now need one tap each to remove. Keep this, safer
   direction?

## Decisions of 2026-09-23

| Topic                         | Owner decision                                                                                                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age without an exact birthday | It is completed years on the **first day of the course**. The operator can correct the age manually. S5 stores its provenance and never invents a birthday.                                                                                          |
| OCR acceptance                | The remaining **fewer than five** target on the good photograph moves to the final Claude Code follow-up and does not block V04–UG2 or the 0.3.0 gate. S4 stays open; no lower threshold, hidden wrong name or discarded text is approved.           |
| Crop appearance               | Confirmed: a modest readable zoom inside the crop, darker subtly blurred exterior and fluid rotation. V04 verifies on phone-sized viewports.                                                                                                         |
| Dictation control             | The responsive V02 appearance is acceptable; no fixed square is required.                                                                                                                                                                            |
| Crew summary sharing          | If a **Copy** action is offered, it must copy the complete summary **image**, never plain text. Download remains an image export.                                                                                                                    |
| Crew capacity                 | D1 and Cabinato crews start at four and permit manual changes. D2–D5 stay fixed at two for the 0.3.0 gate. The Settings-only override for D2–D5 add/remove is deferred to the final Claude Code follow-up. Capacity is separate from screen columns. |
| Selected-name display         | Keep the separate two/three names-per-row choice **only in Settings**; do not add this control to the Equipaggi page.                                                                                                                                |
| PWA icon                      | Working design remains the Home CVC symbol on white with blue `HELPER`; the final product name remains undecided.                                                                                                                                    |

The owner confirmed the two/three-name **display** setting remains. D1/Cabinato
manual capacity adjustment is in C1. The D2–D5 Settings override and its
add/remove controls are deferred to Claude Code after the 0.3.0 gate; this does
not block the gate.

## Privacy history (superseded on 2026-09-26)

On 2026-09-23 the owner deferred a history/tag rewrite. On 2026-09-26 the
owner approved it; it is carried out immediately before the first 0.3.0 push, as described above. The five private
photographs were never committed and remain ignored.
