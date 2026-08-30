# M5 self-review

- Verdict: PASS
- Blockers: none.
- Important findings: none after fixes.

## Scope and behavior reviewed

- The Home `Volontari` card now opens a dedicated current-course area instead
  of a placeholder.
- Each record stores exactly one trimmed name and one canonical role (`ADV` or
  `IS`) in the pre-existing local `volunteers` table.
- Add and edit flows use direct 48 px ADV/IS choices, course-scoped writes,
  explicit loading/error states, and compact touch-friendly list cards.
- Amber staff iconography, role badges, explanatory copy, a separate repository,
  and a separate invariant read guard keep staff visually and semantically
  distinct from students.
- The browser journey creates both roles, edits one, reloads persistence, and
  then opens Allievi to prove the staff records did not enter the student list.

## Findings addressed

- Removed an initially considered volunteer-delete action. Deletion is not an
  M5 acceptance requirement and could create dangling historical crew
  references once later milestones use staff in crews. Add/edit is the safe,
  approved MVP surface for this milestone.
- Hardened the invariant check so a persisted null or blank volunteer name is
  reported as invalid instead of throwing while validation runs.

## Mobile and accessibility review

- `.evidence/M5/volunteers-iphone13.png` was visually inspected. The header,
  short semantic note, add target, list cards, role badges, and fixed navigation
  fit without overlap; the staff treatment is clearly different from Allievi.
- Interactive targets are at least 44 px; role selection uses native radios;
  list and navigation controls have explicit accessible names.
- The same journey passes the Pixel 7 and iPhone 13 Playwright profiles.

## Known limitations

- Volunteer removal/disable semantics are intentionally not invented in M5.
  They should be decided with historical crew-reference behavior if later
  product requirements need them.
- ADV/IS can be stored now; actual placement into crews belongs to the later
  crew milestones.
