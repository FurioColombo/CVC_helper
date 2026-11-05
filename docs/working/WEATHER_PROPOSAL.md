# Proposal — the Vento section

> Working document · Owner: the owner · Fold at: 0.6.0

The owner asked on 2026-11-05 for a weather section on a side branch: wind first,
the next session in detail, the next 24 hours in detail, the coming days as an
overview, over the sailing week with a seven-day mode, blending models by their
technical and regional strengths. This branch holds this proposal and a working
build of it. Nothing here is merged; `02_MVP_SCOPE.md` and the plan are unchanged
until the owner adopts it (§9).

The first build went to six independent reviewers. Four returned FAIL, and the
method reviewer showed that the evidence behind the first weights did not hold.
Everything below describes the second build; §4 and §10 say what changed and why.
The reports are in `docs/working/weather-reviews/`, screens in
`docs/working/weather-screens/`.

## 1. What it is

A full-width **Vento** line on Home, above the six cards, and one **Vento** screen
behind it. It answers one question, on the dock, in a hurry: _what wind will we
have when we go out, and is there a reason to doubt it?_ It never says whether to
go out. That stays the instructor's decision.

In the screen's order:

| Part                 | Shows                                                                                                          | Why it is there                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Home line            | `NW 15 kn raffiche 25` for the next session, from the last download, with its age when old                     | The answer without a tap. It contacts nobody                               |
| Next session         | Expected wind and gust large; direction, name, force; likely range; thunder, division, change; hour by hour    | The decision of the moment                                                 |
| Nell'area (Cabinati) | Each place's expected wind and gust, opening by itself when they differ by 3 kn or more                        | A cruising area differs by place; one number would hide that               |
| La settimana         | One grid: a column per day, AM and PM, direction letter, knots, gust, one blue deepening with the wind         | The grasp of what is coming. A tap puts that half-day in the section above |
| Prossime 24 ore      | One chart without sideways scroll: thick line expected, band likely, thin stepped line gusts, sessions by name | The shape of the day                                                       |
| Mappa LaMMA          | LaMMA's own Bonifacio map for the chosen session, wind or waves, hour by hour                                  | The owner's preferred source, unaltered                                    |
| Modelli e pesi       | Every model's number, grid and weight at that hour; how often range and gust held                              | So the blend can be checked, not trusted                                   |
| Altre fonti          | Meteomar, LaMMA, Windy, Windfinder                                                                             | One tap to the tools in use. Meteomar first: it is the official bulletin   |

**Areas** follow the course: Deriva opens on Cala Fico, Isola del Porco and Punta
Rossa; Cabinato on all of Caprera, La Maddalena, Spargi, Cannigione and Liscia di
Vacca. A switch shows the other one.

**Horizon.** The switch moves only the grid. Settimana is what remains of the
course's sessions; 7 giorni is every half-day from now. Settimana is the default
from seven days before the course until its last session ends.

## 2. Sources: what each can and cannot give

Tested on 2026-11-05, not assumed.

| Source          | Point data a phone can read?                                                                                                                  | Verdict                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Open-Meteo**  | Yes: no key, open CORS, several models in one request                                                                                         | **The numeric base.** It carries the raw national models, so the blend can weigh each one. Free tier: non-commercial, CC BY 4.0        |
| **LaMMA**       | **No.** Maps are public, but its server sends no CORS header, so a browser can show them and cannot read them. Its open-data feed has stopped | **Shown as maps, not blended.** MOLOCH (LaMMA), from ECMWF, with a Bonifacio frame covering every place above. CC BY-ND. See §7 item 4 |
| **Windy**       | Paid API (EUR 990 a year, confirmed), and the free tier returns scrambled data                                                                | **Link only.** It redraws the same models; blending it would count them twice                                                          |
| **Windfinder**  | No free public API; it offers a business API on request                                                                                       | **Link only.** It redraws the same globals                                                                                             |
| **OpenWeather** | Yes, with a key, and a key in a phone app is a public key; a backend is a non-goal (`03` §8)                                                  | **Left out.** A proprietary blend of the same globals, with no regional advantage to add                                               |

**Not double-counting is the point.** These services are mostly different windows
on the same few models. What counts as independent is the model, not the website.

## 3. The blend

Seven models, each with a weight at five lead times, interpolated in between so
nothing steps. Tables in `src/domain/windConfig.ts`, logic in `src/domain/wind.ts`.

| Model                       | Grid   | ≤12 h | 36 h | 60 h | 96 h | ≥144 h |
| --------------------------- | ------ | ----- | ---- | ---- | ---- | ------ |
| AROME HD (Météo-France)     | 1.3 km | 30    | 25   |      |      |        |
| ICON-2I (ItaliaMeteo-ARPAE) | 2 km   | 15    | 15   | 20   |      |        |
| ARPEGE (Météo-France)       | 11 km  | 15    | 15   | 20   | 20   |        |
| ICON-EU (DWD)               | 7 km   | 10    | 10   | 15   | 15   |        |
| IFS (ECMWF)                 | 9 km   | 15    | 15   | 20   | 30   | 40     |
| AIFS (ECMWF, AI)            | 25 km  | 5     | 8    | 10   | 15   | 20     |
| GFS (NOAA)                  | 25 km  | 10    | 12   | 15   | 20   | 25     |
| ECMWF ensemble median       | 25 km  |       |      | 5    | 30   | 45     |

How each choice follows from the wind, not from convenience:

- **Sea cells.** `cell_selection=sea` asks for the nearest water cell: the land cell
  sits on a different surface and elevation, and at one tested hour read less than
  half as much.
- **Weighted median, not mean.** One model far from the rest moves the centre little
  and shows up in the band.
- **Each model counts once.** A model's speed is averaged over the area's points
  first, so the band measures models disagreeing, not places differing. In the first
  build a real difference between Spargi and Cannigione read as "models divided".
- **The headline is the expected wind and the gust.** A range as headline asked the
  reader to do the choosing. The likely range is one line below, labelled "Probabile",
  and dressed to at least ±3 kn because model spread alone contained the real wind
  only half the time; dressed it holds about 7 hours in 10 (§4).
- **Gust is the highest model's, not a quartile**, and never less than 1.5 times the
  band's top. The first rule's number was passed 85% of the time with a bias of −3.9
  kn; this one about 64% and −1.2 kn. It is still no ceiling, the screen says so, and
  no gust is printed beyond 5 days.
- **Division is named, or nothing is said.** The old alta/media/bassa label is gone.
  "Modelli divisi sulla forza, tra 8 e 20: preparati per 20", or "sulla direzione: NW
  o SE". Silent when they agree, and only inside 3 days. It mostly earns its place: at both capes at
  +1 d, and at La Chiappa short range, the expected wind erred 3.2–3.7 kn when it showed, against 1.7–2.1 otherwise. At Cap Pertusato short range, where it showed in 3% of sessions, it told nothing, and at the airports little.
- **Beyond 3 days the number wears a `~`**, "solo una tendenza"; beyond 5 days the
  screen says it is worth little more than the seasonal mean. Days 5–7 scored about
  the same as climatology.
- **Lead time counts from the download**, not from now: an old copy keeps its
  long-range caution. A session in its last hour gives way to the next one.
- **Handover without a step.** Weights are continuous and a run fades over its last
  hours, so nothing jumps when AROME ends.
- **Families capped at half inside 3 days**, ensemble included. Beyond that the
  days are mostly ECMWF on purpose, because it scored best there and little else
  remains.
- **Dropped from the first build:** AROME 2.5 (r = 0.998 with AROME HD: one vote
  counted twice), UKMO (its data is CC BY-SA, a licence question for no gain), the
  "strong westerly" warning (an artefact of airport data, unsupported on sea cells),
  temperature and wave period (not asked for).

## 4. The evidence for the weights

The first backtest scored models against two airports' METAR on land cells. The
method reviewer showed it could not support weights for open water: land stations
favour models that see land the same way. `scripts/weather-backtest.mjs` was
rewritten. It now uses **exposed capes** on **sea cells**: Cap Pertusato (107 m) and
La Chiappa (57 m), Météo-France hourly open data, Licence Ouverte, June to October
2026, sailing hours, one common sample per comparison. Airports stay as a control.
Output: `docs/working/weather-backtest.json`.

Mean speed error at +1 day, knots, common sample:

| Site | AROME | IFS  | ARPEGE | GFS  | ICON-2I | ICON-EU | UKMO | AIFS |
| ---- | ----- | ---- | ------ | ---- | ------- | ------- | ---- | ---- |
| PERT | 2.67  | 2.88 | 3.09   | 3.18 | 3.20    | 3.33    | 3.44 | 4.17 |
| CHIA | 3.25  | 3.82 | 3.48   | 3.87 | 3.42    | 4.34    | 3.84 | 3.95 |

The blend itself, computed by the app's own domain code:

| Site, lead | Hours inside range | Width kn | Session error kn | Gust bias kn | Gust passed | Division shown |
| ---------- | ------------------ | -------- | ---------------- | ------------ | ----------- | -------------- |
| PERT short | 74%                | 6.4      | 1.78             | −0.9         | 63%         | 3%             |
| PERT +1 d  | 67%                | 6.5      | 2.20             | −1.4         | 65%         | 8%             |
| CHIA short | 75%                | 6.7      | 1.94             | −0.9         | 65%         | 15%            |
| CHIA +1 d  | 71%                | 6.7      | 2.37             | −1.5         | 64%         | 20%            |
| Land, +1 d | 54–63%             |          | 2.26–2.64        |              |             |                |

For scale, the first build's median at +1 d erred 2.45 (PERT) and 3.04 (CHIA), and
its range held about 50% of hours. When the wind leaves the range it is usually above it (14–23% of hours at the capes): "Probabile" is no upper limit either.

What this changed from the first proposal, and it retracts three things it said:

- **"ECMWF is not the best here" is withdrawn.** On sea cells IFS is second at PERT
  at +1 d, and at 7 days it beats GFS at both capes (5.41 vs 6.10; 4.55 vs 5.80).
- **"GFS catches it beyond day 5" is withdrawn**, for the same reason.
- **"Every model reads low in westerlies" is withdrawn.** It came from airports.
- **AROME still leads at short range**, and ICON-2I is close behind it at La Chiappa,
  the site nearest in kind to the Bocche's gaps.
- **No bias correction**: there are no readings from the water to base one on.

**Limits, stated plainly.**

1. Capes are not Cala Fico. They are the nearest exposed open data, about 30 km off,
   at 57 and 107 m, one season. The ranking is evidence; the errors do not transfer.
2. The archive holds some models only to shorter leads than they reach, and the
   ensemble has no archive: its weight is a prior, not a measurement.
3. The scale at which the range holds about 7 hours in 10 was tuned on this same
   season, so expect it to do a little worse on a new one.
4. I found no published verification for the Bocche itself. Real verification needs
   readings from the water (§7).

## 5. Interaction: the questions asked, and the answers built

| Question                     | Choice                                                                                                  | Rejected, and why                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does it live?          | A flat line above the six cards                                                                         | A seventh card breaks the 2×3 grid. A bottom-bar tab would demote Avarie or Equipaggi                                                                 |
| What order?                  | Session, week, 24 hours, map                                                                            | The brief's order puts 24 hours second, but then a tap on the week moves the answer off the screen. **Departs from the brief: your call (§7 item 8)** |
| One number or a range?       | Expected wind and gust large, range below                                                               | A range as headline hid the number instructors say aloud. A wind bar drawn for the range added nothing a text line lacks                              |
| Traffic light, go or no-go?  | No                                                                                                      | Whether 18 kn is fine depends on level, boats and instructor. A green from a phone would be a liability, and limits per level are not in the spec     |
| Show uncertainty how?        | In words, saying what and what to do. Neutral mark in the grid. Red only for thunder                    | Percentages imply a calibration nobody has done. An orange triangle on most days taught people to ignore it                                           |
| Week: arrows or letters?     | Letters, 8 points, and one blue for strength                                                            | Arrows blur at 40 px in sun; a rainbow scale fails R06 and print                                                                                      |
| How do I reach a detail?     | Tap any half-day: the top becomes that session, announced, no scroll if it is in view. One button back  | Separate screens multiply Back paths, a known weak spot of the app                                                                                    |
| Chart: next 24 h or session? | The next 24 h always, sessions named with their day                                                     | Following the pick would stop it being "next 24 hours", which you asked for, and a bare "PM" could be read as the wrong day                           |
| Compare models?              | Folded list at the end                                                                                  | Open by default it pushes the answer down; hidden entirely it asks for trust                                                                          |
| Which arrow convention?      | Points where the wind goes, as on LaMMA's map                                                           | Pointing to the source contradicts the map on the same screen                                                                                         |
| Cabinati vs Derive detail    | Places only for Cabinati; waves only for Cabinati                                                       | Three points a kilometre apart are one answer at model resolution, and open-sea waves say little inside Cala Fico                                     |
| No signal on the dock?       | Last forecast stays with its age, past hours drop off. From 6 h marked; from 24 h Home stops quoting it | A blank screen is useless and a silent old forecast is dangerous                                                                                      |

**Privacy.** Home contacts nobody for weather, ever: `04` §"Nothing connects before
sign-in" is the current promise, so the line reads only the last copy. Opening Vento
is what connects, and the screen says so. Requests carry each area's fixed coordinates
and nothing else: no course, no name, no account. What a provider can still see, and
a notice should say: the phone's IP address, the Origin, User-Agent and language, the
hour; the coordinates reveal the course's family, and the LaMMA step the distance to
the next session. The forecast lives in `localStorage`, never in the course database,
and is checked field by field on reading: it needs no backup, leaves the synced schema
alone, and erase, replace, import and reset all remove it.

## 6. Decisions taken for you (reversal is a normal change)

1. **Side branch from `claude/0.5.0-prep`** at `4a97c1a`, not pushed.
2. **No milestone registered and no contract edited**: §9 lists the edits for adoption.
3. **Screen name "Vento",** not "Meteo": it says what the screen is for.
4. **Compass letters are English-style (W, NW)** with the Italian name beside them, as
   on LaMMA's map.
5. **Routing:** blend, data layer and screen by the orchestrating model, as one design
   judgement; the first browser journey by the Sonnet implementer; reviewers on Opus.

## 7. What needs you

| #   | Item                                       | Why                                                                                                                                                                              | Default until you answer                                                |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Real session hours**                     | The specification gives sessions no clock time (`01` §7.1) and a forecast needs one                                                                                              | AM 9–13, PM 14–18, one line in `windConfig.ts`                          |
| 2   | **Where exactly is Cala Fico?**            | OpenStreetMap does not name it                                                                                                                                                   | Estimated at 41.178 N, 9.478 E. Please check all three Derive points    |
| 3   | **Are the Cabinati points right?**         | Chosen just off each place you named; you know where boats go                                                                                                                    | As in `windConfig.ts`                                                   |
| 4   | **Write to LaMMA** (info@lamma.toscana.it) | **Required before release:** its disclaimer says information on use must be sent to it. Ask too: real grid size, forcing beyond +60 h, a point series or CORS header for Caprera | Maps shown on the branch only. I have not written: that is your message |
| 5   | **Open-Meteo's terms**                     | The free tier is non-commercial, under 10,000 calls a day. Does a centre's tool qualify? open-meteo.com/en/terms                                                                 | Free tier                                                               |
| 6   | **A line to the instructors**              | Opening Vento sends the phone's address to two third parties. It belongs in Impostazioni and the README                                                                          | Stated on the screen only                                               |
| 7   | **May Home refresh by itself?**            | It would keep the line fresh, and contradict `04`'s "nothing connects". One word in `WeatherHomeCard.tsx`                                                                        | No: Home never connects                                                 |
| 8   | **Screen order**                           | I moved the week above the 24 hours (§5). Swapping back is two lines                                                                                                             | Session, week, 24 h, map                                                |
| 9   | **"My limit" threshold**                   | A knot value per instructor, marked in the grid, is the feature most asked of such tools, but needs a spec line                                                                  | Not built                                                               |

**Merge gate.** Tapping into Vento connects before sign-in. That must be accepted in
writing with `04_IMPLEMENTATION_PLAN.md:58`, `03_TECHNICAL_DECISIONS.md:427-429` and
`docs/DEPLOY.md:194-198` amended together; until then this branch does not merge.

**The next real step in accuracy: log the wind.** One tap at the end of a session
("reale: 14 kn NW") per place would, in one season, replace cape evidence with
measurements from the water, and show whether LaMMA, AROME or ICON-2I reads the
Bocche best. Not built: it adds data to the course model and deserves its own decision.

## 8. Known limits of this build

- LaMMA is not in the numbers. Fixing that needs LaMMA's help or a small server, and a
  backend is a non-goal (`03` §8). Reading colours from its maps was rejected: it needs
  a server too, breaks on any restyle, and CC BY-ND forbids derivatives.
- LaMMA maps need signal, and there is no offline copy until its licence is checked.
  The app cannot read which run is out, so the time label is an estimate; the time
  printed on the map is the true one, and the screen says so.
- Waves are offshore (about 8 km grid).
- Models at 1–2 km do not resolve Isola del Porco's lee or a gap between two islands.
  Local knowledge beats this screen, and it says so at the bottom.
- Reviewed and deliberately left: system Back through a picked half-day, steppers
  between half-days in the session section, downloading both areas on first open, gust
  spread in the division rule, focus back to the Home line on Back (shell behaviour,
  for the backlog), `aria-pressed` vs radiogroup, clearing on sign-out, whether Home's
  line needs Open-Meteo's attribution (ask them with item 5).

## 9. To adopt it

A **FEATURE** milestone, say WX1, in 0.5.x or 0.6.0; independent of sync. A security and
privacy review is required (new network calls).

- `01_PRODUCT_SPEC.md`: add the Vento section and the rule that it gives no go/no-go.
- `02_MVP_SCOPE.md`: add it to the road in §4.
- `03_TECHNICAL_DECISIONS.md`: add Open-Meteo and LaMMA as permitted third-party calls;
  add the cache rule; amend lines 427-429.
- `04_IMPLEMENTATION_PLAN.md` and `.milestones/manifest.json`: register WX1; amend line 58.
- `docs/DEPLOY.md:194-198`: amend. CSP backlog hosts when a CSP lands: `connect-src`
  api, ensemble-api and marine-api.open-meteo.com; `img-src` www.lamma.toscana.it.
- `README.md`: third-party section. `CHANGELOG.md`: user-visible entry.
- `docs/design/07_PAGE_CHANGELOG.md`: add the page and amend P01 for the Home line.
- Add the disclosure to Impostazioni.
- Move the tables' reasons from this file into `03`, and fold this document.

## 10. What the reviews changed

Reviewed at `de89666`. UI FAIL, accessibility FAIL, field UX FAIL, method FAIL, security
FAIL, code quality PASS_WITH_FINDINGS. Fixed unless §8 or §7 lists them.

| Reviewer      | What it proved                                                                                                      | What changed                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Method        | Airports on land cells cannot rank models for open water; gust and range badly calibrated                           | New backtest on capes and sea cells; new weights; dressed range; new gust rule; three claims withdrawn                   |
| Method        | Bucket edges made the blend step; per-point band read places as models                                              | Continuous weights; each model counts once; lead from the download                                                       |
| Security      | Home refreshed by itself against `04`; a hostile answer could lock the app; a late answer could restore erased data | Home never connects; every field validated; abort on leaving; erase, replace, import and reset clear it; new tests       |
| Security      | LaMMA's licence requires reporting use; UKMO's licence differs                                                      | §7 item 4; UKMO dropped; attribution and "elaborati" on the screen                                                       |
| Field UX      | A range headline had to be decoded; "Modelli divisi" gave no action; age hidden on Home                             | New headline; division says what and what to do; age on the line; session in its last hour gives way to the next         |
| UI            | A wall of table rows; arrows unreadable small; colour scale failed in sun; chart text too small                     | Grid with one blue; letters; chart in real pixels following the phone's text size                                        |
| Accessibility | Text at 200% broke the layout; names read as bare numbers; focus lost when a button vanished                        | Tested at 200% on 320–412 px; every cell and hour has a full spoken name; focus moved; live announcement; reduced motion |
| Code quality  | Dead options, a case-colliding file pair, duplicated constants                                                      | Removed; `WindLammaMap.tsx`; one table for each number                                                                   |
