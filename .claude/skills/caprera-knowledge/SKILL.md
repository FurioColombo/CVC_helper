---
name: caprera-knowledge
description: Where each fact about the Centro Velico Caprera lives and how far to trust it — the Italian domain terms of the spec (comandate, equipaggi, taglia, A terra, Mezzi, Derive and Cabinati, course codes, sessions, ADV/IS/CT, valutazioni), the centre's places, the owner's decisions, the local internal documents (manuals, the CT, volunteer and AT guides, older programmes) and the archive. Use for any question about the centre, its courses, places or terms, before hunting for a domain fact, and whenever the spec seems to lack one.
---

# Caprera knowledge

A map, not a copy. Canonical truth lives once (`AGENTS.md` §10), so this file
names where each kind of fact is and how much it weighs; read the section it
points to and never quote a rule from here. Codex follows this file directly.

## When to use it

A question about the centre, a course, a place or a term; a domain fact the
active milestone lacks; a source that seems to disagree with the spec.

## Authority for Caprera facts

Consistent with `AGENTS.md` §2, highest first:

1. The owner's instruction in the current task.
2. `01_PRODUCT_SPEC.md` (domain and behaviour), `02_MVP_SCOPE.md` (what is
   in or out), `03_TECHNICAL_DECISIONS.md` (how). The finite tables are typed
   once in `src/domain/config.ts` (01 §11, 03 §4); the code follows the spec.
3. `docs/working/OWNER_DECISIONS.md`: provisional decisions until folded into
   a contract. `docs/working/BACKLOG.md` lists owner-named future work, which
   is not scope.
4. The owner's evidence records: `.evidence/WX1/owner-places.json` for places.
5. The centre's documents (manuals and guides): local, background only. The
   owner ruled that they do not change the spec (decision 26).
6. `archive/`: history and rationale, never authority.

`04_IMPLEMENTATION_PLAN.md` and the design documents rank as §2 says; they
hold few domain facts. When sources disagree, the higher one stands and no
product semantics change silently. A genuine contradiction is escalated under
`AGENTS.md` §14; anything smaller is logged as a question or a provisional
choice in `docs/working/OWNER_DECISIONS.md`, and work continues.

## Term index

Sections are in `01_PRODUCT_SPEC.md` unless stated otherwise. A term missing
here: search the spec, then `src/domain/config.ts`, then the sources below.

| Term                                            | What it names                               | Where                                 |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| Corso, `Crea corso`, `D2 - 35 \| 2026`          | the course and its identity line            | §2                                    |
| Deriva / Cabinato (`D` / `C`); Derive, Cabinati | course family: dinghy, cabin yacht          | §2, §4.1                              |
| D1–D5, C1–C5                                    | family plus level                           | §2; default boats §4.1                |
| D1J, D2J                                        | junior courses, not modelled                | `BACKLOG.md` future work; decision 26 |
| Corsi di due settimane                          | two-week courses, after 1.0.0               | `BACKLOG.md` future work; decision 26 |
| Allievi                                         | students                                    | §3                                    |
| Età, Minorenne (`M`)                            | declared age, minor marker                  | §3.1                                  |
| Taglia XS–XL                                    | operational size                            | §3.1, matrix §7.4; decision 26        |
| Conoscenza allievi                              | size and initial note per student           | §3.3                                  |
| Scan allievi, Usa un assistente                 | adding students from a sheet                | §3.6, §9                              |
| Barche; Disponibile, Da controllare, Non disp.  | boats and their list states                 | §4.1–4.2                              |
| Avarie: Aperta, Comunicata, Risolta             | boat faults                                 | §4.3                                  |
| Volontari: ADV, IS, CT                          | volunteer roles (not expanded in the spec)  | §5                                    |
| Comandata, Comandate                            | the daily duty rotation, Saturday to Friday | §6                                    |
| Giorni con più persone                          | days that take the remainder                | §6.2                                  |
| Ricalcola comandate rimanenti                   | the midweek recalculation                   | §6.3                                  |
| `C`, `SM` (smontante)                           | on duty, just finished duty                 | §7.2                                  |
| Equipaggi                                       | crews                                       | §7                                    |
| Sessioni `sat-pm` … `fri-pm`, AM/PM             | the thirteen outings                        | §7.1, §11                             |
| A terra                                         | a person kept ashore                        | §7.2–7.3                              |
| Mezzi                                           | support craft as a crew destination         | §7.3                                  |
| Avvisi, triangolo rosso/giallo                  | warnings and their severity                 | §6.1, §6.3, §7.4                      |
| Lettura, riepilogo equipaggi e comandate        | the announcement views and their image      | §7.5                                  |
| Valutazioni `++ + = - --`                       | the day-by-day judgement per session        | §8; decision 26                       |
| Tecnica, Senso nautico                          | the manuals' formal end-of-course marks     | decision 26 only; not built           |
| Impostazioni                                    | settings, course files, reset               | §2                                    |
| Vento                                           | the wind forecast                           | plan WX1; `02` §4                     |

## Places

`.evidence/WX1/owner-places.json` is the record (the owner, 2026-11-11); it
holds exact coordinates, notes, the Derive areas' extent and the proposed
forecast points. Positions below are rounded.

| Name                                       | Rough position                           | Certainty            |
| ------------------------------------------ | ---------------------------------------- | -------------------- |
| Porto Palma                                | the gulf ("golfetto") the Derive sail in | named by the owner   |
| Scalo Centro Velico Caprera                | 41.186 N 9.442 E                         | given                |
| Cala Fico                                  | 41.186 N 9.444 E                         | given                |
| Base Settimanale                           | 41.187 N 9.444 E                         | given                |
| Base Punta Coda (Batteria Punta Coda)      | 41.189 N 9.434 E                         | given                |
| Base Cabinati                              | 41.191 N 9.447 E                         | given                |
| Pontile Cabinati                           | 41.191 N 9.449 E                         | given                |
| Pontile del terzo (Pontile di Porto Palma) | 41.191 N 9.450 E                         | given                |
| Spiaggia Due Mari                          | 41.183 N 9.463 E                         | given                |
| Caletta Vaurien                            | 41.186 N 9.443 E                         | position approximate |
| Cala degli Inglesi                         | 41.184 N 9.457 E                         | name not fully sure  |
| Okinawa (Spiaggia Cani Caprera on maps)    | 41.187 N 9.456 E                         | name not fully sure  |
| Cala Merda                                 | between the Scalo and Base Cabinati      | position unknown     |

The forecast areas and points (Derive and Cabinati) are in
`src/domain/windConfig.ts` and `docs/working/WEATHER_PROPOSAL.md` on the
unmerged branch `claude/weather-section`; they arrive with milestone WX1. The
branch carries the owner's Derive points and the forecast's session hours
(`sessionHours`: the CT guide's timetable, widened by the owner to 8–14 and
14–19 on 2026-11-12); the Cabinati points are still open (`stillOpen`). A map of the places is owner-named future work (`BACKLOG.md`).

## How to search

| Source                          | Command                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Spec, scope, decisions          | `grep -n -i "<term>" 01_PRODUCT_SPEC.md 02_MVP_SCOPE.md 03_TECHNICAL_DECISIONS.md` |
| Typed tables                    | `grep -n -i "<term>" src/domain/config.ts`                                         |
| Owner decisions, backlog        | `grep -n -i "<term>" docs/working/OWNER_DECISIONS.md docs/working/BACKLOG.md`      |
| Places                          | `cat .evidence/WX1/owner-places.json`                                              |
| Vento branch                    | `git grep -n -i "<term>" claude/weather-section -- src/domain docs/working`        |
| Centre's documents (local only) | `grep -rn -i "<term>" data/knowledge/*/text/`                                      |
| Archive                         | `grep -rn -i "<term>" archive/`                                                    |

## The centre's documents

`data/knowledge/` is git-ignored and exists only on the owner's computer; a
clone does not have it. Read `data/knowledge/INDEX.md` first: it says what
each folder and file is, its date, how the scanned ones were transcribed, and which
versions were left out as duplicates or superseded. In short:

- `manualistica-2026/` (own index): the 2026 Deriva manuals, D1, D2 and the
  junior variants: weekly programmes, end-of-course competences, lesson cards.
- `guida-ct/` (own index): the Capo Turno's guide, with the bases' logistics,
  the comandata's hours and the school's timetable (page 20).
- `guida-volontari/`: the 2026 volunteers' guide: roles, rules, evaluations
  and their privacy, the organisation per base, the evaluation cards.
- `guida-at/`: the Assistente del Turno's guide: the comandata service at
  each base, and the weekly comandata plan form.
- `programmi-corsi/`: older programmes for D3–D5, C1–C5 and special courses,
  and blank 2014 duty boards and crew sheets. D4 ("2D", 2015) has two
  transcribed documents: the instructors' programme and the website's.
- `sicurezza/`, `statuto-norme/`, `moduli/`, `ordinanze/`: first aid and man
  overboard; statute, ethics code, norme di vita; blank forms; the 2026 La
  Maddalena navigation ordinance (transcribed; the index says what touches
  the centre).

Where documents overlap, the newer wins: the 2026 manuals and guides over the
older programmes. What any of them says is context, not a requirement:
decision 26 records the owner's reading. A fact that would change the product
goes to the owner as a question; it enters the spec only through their
decision.

## The archive, where it helps

- `archive/v0.7_design_history/02_DOMAIN_AND_RULES.md`: the first domain model
  and the early decisions behind it.
- `archive/v0.7_design_history/04_OPEN_QUESTIONS.md`: the early question log,
  including why A terra is a placement and Mezzi a destination.
- `archive/v0.8_working_set/01_PRODUCT_SPEC.md`: the spec as the MVP began.
- `archive/v0.2.0-design-history/sources/`: the owner's original annotated
  requests (`05_…`) and answers before the 0.2.0 mocks (`08_…`), in Italian.
- `archive/v0.3.0/0_3_0_OWNER_BRIEF.md`: the owner's brief for 0.3.0.
- `archive/v0.4.0/OWNER_DECISIONS*.md`: the settled 0.4.0 decisions.
- `archive/v0.1.0/`: the 0.1.0 plan and evidence, such as the first duty and
  smontante mappings.

## Privacy

The centre's documents are internal ("Uso interno"): never commit, quote or
paraphrase their content in this public repository; pointers only.
Never open `data/private/` (real rosters and OCR) or record a real person's
data; examples use synthetic names (`AGENTS.md` §17).
