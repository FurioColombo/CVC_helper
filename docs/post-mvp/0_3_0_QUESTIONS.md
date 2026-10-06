# Owner decisions and open questions — 0.3.0

Updated 2026-10-06. The newest decisions and the questions still open are
first; older decisions follow. Later decisions supersede earlier ones where
they differ. The plan toward a shared database and 1.0.0 is in
[`1_0_0_NEXT_STEPS.md`](1_0_0_NEXT_STEPS.md).

## Decisions of 2026-10-04

After using the deployed F4 on their Android phone:

| Topic                          | Owner report or decision                                                                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saving the image               | Copying works; the download is redundant with the copied screenshot and is removed. Keep **copy and share** only.                                                                                                                                                |
| The image itself               | Broken on the phone: names wrap after a few letters with room to spare and are drawn over the next line, double names and surnames break, the "Equipaggi senza barca" heading runs under the cards, third lines leave the card. The image must match the screen. |
| Summary content                | Volunteers (`ADV`, `IS`, `CT`) who are not in a crew are not shown. "Tutti gli allievi assegnati" stays on screen but not in the image.                                                                                                                          |
| Home menu                      | Every menu card takes the blue accent; no red.                                                                                                                                                                                                                   |
| Update banner                  | (2026-10-06) Seen a couple of times; uninstalling and reinstalling is more reliable, but the banner is accepted for now. A more reliable update goes to future work.                                                                                             |
| Copies made before the rewrite | (2026-10-06) Claude Code wrote the prompt for the Codex session that deletes them.                                                                                                                                                                               |
| Release                        | (2026-10-06) The deployed app is 0.3.0 for the owner. The two remaining items move to future work.                                                                                                                                                               |
| iPhone checks                  | (2026-10-06) Deferred until the owner says: they have no iPhone.                                                                                                                                                                                                 |
| GitHub Support                 | (2026-10-06) Not contacted; the purge request stays in future work.                                                                                                                                                                                              |

## Decisions of 2026-10-03

After using F3 on their Android phone (planned as F4):

| Topic                    | Owner report or decision                                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical checks (UG2)    | **Pass on Android**: phone Back, the assistant paste from the ChatGPT and Claude apps, and the installed app offline.                                                                                                                                                                        |
| Free seat and volunteers | Tapping `Posto libero` and then a volunteer must put the volunteer in that seat (it did not).                                                                                                                                                                                                |
| Summary image            | The summary page is now very good; the drawn image is not. The image must simply be a screenshot of the summary's content, without the phone's status bar, saved straight to the gallery and copied, so it can be pasted in WhatsApp. The button becomes a floating one at the bottom right. |

## Decisions of 2026-09-28

The owner answered the eight questions below after using the app, and asked
for new work, planned as F2 and F3 in `04_IMPLEMENTATION_PLAN.md`.

| Topic                           | Owner decision                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Old history on this computer | A new Codex session deletes the old Codex worktree and the pre-rewrite checkpoint refs; Claude Code wrote its prompt. **GitHub Support is not contacted for now.**                                                                                                                                                                                                                 |
| 2. Rows from an assistant       | **Trust the paste**: no per-row `Controlla`; the owner checks the rows. Keep the `Sono tutti` count confirmation (F2).                                                                                                                                                                                                                                                             |
| Paste on a phone                | The ChatGPT app's copy button on a phone gave "not in the requested format" for an answer a PC read. To fix in F2.                                                                                                                                                                                                                                                                 |
| Age and date of birth           | **Age only, in every mode**: scan, paste and manual entry keep the age on the first course day, never the date of birth (F2).                                                                                                                                                                                                                                                      |
| Ways to add students            | The Allievi menu and the empty Allievi page must open the same methods page, and the empty page must offer the scan and the assistant too (F2).                                                                                                                                                                                                                                    |
| 3. Open fault as a crew warning | **Yes**, a yellow crew warning (F3).                                                                                                                                                                                                                                                                                                                                               |
| Crew summary and image          | All crews in one window, two columns; after two rounds of proposals the owner chose **C6** (grouped by boat model under the class logo, class-colour edge, boat number on the left; target `mockups/f3-crew-summary-c6.html`). The exported image must be readable, like a screenshot of the summary, and hold every crew. A Comandate summary and export in the same format (F3). |
| Mezzi icon                      | A gommone seen from above, drawn with the owner from a photo of the centre's RIB (2026-09-28/29): tubes as a double line whose tails run past the transom, a softly pointed bow, the propeller as an ∞ between the tails, no shaft. Horizontal in the Mezzi heading, vertical in the cards (F3).                                                                                   |
| 4. Erasing the course           | Accepted for now; a full local reset goes to future work.                                                                                                                                                                                                                                                                                                                          |
| 5. Duplicate check              | **Keep it on both** the camera and the assistant path.                                                                                                                                                                                                                                                                                                                             |
| 6. Physical checks              | Camera scan: **works very well**, now definitely usable, and with the paste fallback the owner is satisfied. Speech: kept as it is for now, but too slow and imprecise; improving it, including downloading the model with the app, goes to future work.                                                                                                                           |
| 7. Staff headings               | **Fine as it is.**                                                                                                                                                                                                                                                                                                                                                                 |
| 8. Rewritten `v0.2.0`           | **Accepted**: `v0.2.0` is an archive, no second rewrite.                                                                                                                                                                                                                                                                                                                           |

## Decisions of 2026-09-26

| Topic                        | Owner decision and what was done                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Git history           | **Rewrite it.** Rewritten on a fresh mirror immediately before the first 0.3.0 push: real students' and staff names, birth dates and telephone numbers replaced by invented values in every commit and message of `main`, `codex/0.3.0`, `codex/post-mvp-ux-planning` and the `v0.2.0` tag. Results, aggregate counts only, are in `.evidence/F1/history-rewrite.json`. The current files were already clean and do not change. |
| New course                   | **Add it, in Settings.** `Elimina il corso e inizia un nuovo corso` erases the course from the device after a confirmation, then opens course creation.                                                                                                                                                                                                                                                                         |
| Volunteers and crew warnings | **Volunteers do not count** toward size or repeat warnings. The code already counted students only; a test now proves it.                                                                                                                                                                                                                                                                                                       |
| V05 assistant path           | **Stays in 0.3.0**, beside the camera path.                                                                                                                                                                                                                                                                                                                                                                                     |
| Surname particles            | Keep **Lo, Li, El, Al, De, Di** with the surname. Done and tested.                                                                                                                                                                                                                                                                                                                                                              |

## Still open for the owner

1. **Delete the old copies — done locally, 2026-10-06.** The authorized
   Codex session removed `.codex/worktrees/ux1-pages-promotion/CVC_helper`
   and its parent folder. The two old checkpoint refs were already absent;
   no stale ref remained to delete. Retained session refs have zero
   `data/private/` entries. All 373 remaining reflog entries were expired;
   `git gc --prune=now` removed marker
   `70f62a58231ad5c65634e5a339055e6b551c482d`, which is also absent from
   `git rev-list --all --reflog`. Only the main worktree remains, HEAD was
   unchanged at `7df7574`, and Node 24.19.0 `npm run check:repository`
   passed. Checkpoint verification `npm run verify:quick` passed (56 test
   files, 952 tests). Git object storage fell from about 63.23 MiB to 44.87 MiB;
   the 2,262 ignored private files were untouched. A read-only search under
   the user profile, including Desktop, Documents, Downloads, OneDrive and
   `.codex`, checked 92,105 directories and 12 Git repositories, skipping
   `node_modules` and private data. Only the main checkout matched the
   CVC_helper origin; no additional copy was found or deleted. Two directories
   and 4,379 link targets were unreadable, limiting the search coverage.
   GitHub keeps serving the old commits by their old ids until GitHub Support
   purges them; on 2026-10-06 the owner chose not to contact GitHub Support,
   and the request stays in future work (`1_0_0_NEXT_STEPS.md`).
2. **The physical checks (UG2) — done on Android.** The assistant paste,
   the installed app offline and phone Back (2026-10-03), the F4 summary
   images (2026-10-05) and the update banner, accepted for now (2026-10-06).
   The owner has no iPhone: the iPhone checks (Copia immagine and Condividi,
   and speech, never tested on Apple) moved to future work on 2026-10-06 and
   wait until the owner asks for them.

## Questions of 2026-09-27 (answered on 2026-09-28)

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
8. **The rewritten `v0.2.0` no longer passes its own tests.** The history
   rewrite replaced the real names in two old test files
   (`studentScan.test.ts`, `StudentScan.test.tsx`) with invented ones, but
   not always the same invented name in a test's input and in its expected
   result. At `v0.2.0` and `codex/post-mvp-ux-planning`, three scan unit
   tests therefore fail, and CI on those two refs failed after the push. No
   application file changed: the `v0.2.0` app is exactly what it was, and
   `main` is unaffected (its files are identical to the verified ones and
   its tests pass). Making the old tests pass again needs a second, consistent
   rewrite and another force-push of all four refs, which would also retire
   the commits published today. Recommended: accept it and treat `v0.2.0` as
   an archive. Tell us if you want the second rewrite.

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
