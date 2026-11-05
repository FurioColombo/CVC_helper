# Proposal — the Vento section

> Working document · Owner: the owner · Fold at: 0.6.0

The owner asked on 2026-11-05 for a weather section on a side branch: wind first,
the next session in detail, the next 24 hours in detail, the coming days as an
overview, over the sailing week with a seven-day mode, blending models by their
technical and regional strengths. This branch holds this proposal and a working
build of it. Nothing here is merged; `02_MVP_SCOPE.md` and the plan are unchanged
until the owner adopts it (§9).

## 1. What it is

A full-width **Vento** strip on Home, above the six cards, and one **Vento**
screen behind it. It answers one question, on the dock, in a hurry: _what will
the wind be when we go out, and how sure is that?_ It never says whether to go
out. That stays the instructor's decision.

| Part                 | Shows                                                                                                                                    | Why it is there                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Home strip           | `NW 5–14 kn, raffiche 17` for the next session, with the uncertainty mark                                                                | The answer without a tap, on the screen the instructor already opens |
| Prossima uscita      | Range, direction and its name, expected value, gusts, force, waves offshore, trend, how far the models agree, hour by hour               | The decision of the moment                                           |
| Nell'area (Cabinati) | The same range for Spargi, La Maddalena nord, Caprera est and sud, Liscia di Vacca, Cannigione                                           | A cruising area differs by place; a single number would hide that    |
| Prossime 24 ore      | One chart without sideways scroll: line = blend, band = model spread, dots = gusts, arrows = where the wind goes, shaded = sailing hours | The shape of the day                                                 |
| Settimana / 7 giorni | A row per day, AM and PM side by side; tap one and the top of the screen shows it in full                                                | The grasp of what is coming; one way in to every detail              |
| Mappa LaMMA          | LaMMA's own Bonifacio map for the chosen session, wind or waves, hour by hour                                                            | The owner's preferred source, unaltered                              |
| Modelli e pesi       | Every model's number, grid and weight at that hour                                                                                       | So the blend can be checked, not trusted                             |
| Altre fonti          | LaMMA, Windy, Windfinder, Meteomar                                                                                                       | One tap to the tools already in use                                  |

**Areas** follow the course: Deriva opens on Cala Fico, Isola del Porco and Punta
Rossa; Cabinato on all of Caprera, La Maddalena, Spargi, Cannigione and Liscia di
Vacca. A switch shows the other one.

**Horizon.** Settimana is what remains of the course's thirteen sessions; 7 giorni
is every half day from now. Settimana is the default from seven days before the
course until its last session ends; otherwise 7 giorni.

## 2. Sources: what each can and cannot give

Tested on 2026-11-05 from Caprera's coordinates, not assumed.

| Source          | Point data a phone can read?                                                                                                                                                                                               | Verdict                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open-Meteo**  | Yes: no key, open CORS, several models in one request, about 7 KB per point compressed                                                                                                                                     | **The numeric base.** It carries the raw national models, so the blend can weigh each one                                                                                                                               |
| **LaMMA**       | **No.** Maps are public, but its server sends no CORS header, so a browser can show them and cannot read them. The open-data feed stopped in January 2026 (the newest record on dati.toscana.it, and its files return 404) | **Shown as maps, not blended.** Its coastal product is the best picture of the area: MOLOCH 1.5 km from ECMWF, with a Bonifacio frame covering every place named above. See §7 for the way to bring it into the numbers |
| **Windy**       | Paid API (about €990 a year on aggregator listings, not confirmed on Windy's own page), and its free tier returns scrambled data                                                                                           | **Link only.** It redraws the same models; blending it would count them twice                                                                                                                                           |
| **Windfinder**  | No public API found                                                                                                                                                                                                        | **Link only.** Its forecast for Bonifacio is stated to be GFS-based, which is already in the blend                                                                                                                      |
| **OpenWeather** | Yes, with a key, and a key in a phone app is a public key; a backend is a non-goal (`03` §8)                                                                                                                               | **Left out.** A proprietary blend of the same globals, with no regional advantage to add                                                                                                                                |

**Not double-counting is the point.** These services are mostly different windows
on the same few models. What counts as independent is the model, not the website.

## 3. The blend

Nine models, each with a weight per lead time. Tables in `src/domain/windConfig.ts`,
logic in `src/domain/wind.ts`, both tested.

| Model                           | Grid   | Reach        | 0–24 h | 24–48 | 48–72 | 72–120 | 120+ |
| ------------------------------- | ------ | ------------ | ------ | ----- | ----- | ------ | ---- |
| AROME HD (Météo-France)         | 1.3 km | about 2 days | 18     | 17    |       |        |      |
| AROME (Météo-France)            | 2.5 km | about 2 days | 14     | 15    |       |        |      |
| ICON-2I (ItaliaMeteo-ARPAE)     | 2 km   | about 3 days | 14     | 14    | 20    |        |      |
| ARPEGE (Météo-France)           | 11 km  | about 4 days | 14     | 13    | 20    | 15     |      |
| ICON-EU (DWD)                   | 7 km   | 5 days       | 10     | 10    | 15    | 17     |      |
| IFS (ECMWF)                     | 9 km   | 15 days      | 9      | 9     | 14    | 20     | 26   |
| AIFS (ECMWF, AI)                | 25 km  | 15 days      | 6      | 6     | 9     | 14     | 21   |
| GFS (NOAA)                      | 25 km  | 16 days      | 8      | 8     | 11    | 18     | 29   |
| UKMO (Met Office)               | 10 km  | about 7 days | 6      | 7     | 10    | 16     | 24   |
| ECMWF ensemble median (51 runs) | 25 km  | 15 days      |        |       | 5     | 30     | 45   |

How each choice follows from the wind, not from convenience:

- **Sea cells, not land.** `cell_selection=sea` asks each model for its nearest
  water cell. At the same hour ECMWF read 5.4 kn on its default land cell and
  12.2 kn on sea: more than double, from friction alone.
- **Weighted median, not mean.** One model far from the rest moves the centre
  little and shows up in the band. Averaging would hide exactly the disagreement
  worth seeing.
- **Speed and direction apart.** Averaging wind vectors shrinks the speed when
  models differ on direction; a 15 kn wind with two opinions would read as calm.
  Direction uses a circular mean, and light or scattered wind reads `VAR`.
- **A range, always.** The headline is where the models fall (20th to 80th weighted
  percentile), stretched to include how the wind moves in that session. Eight
  building to twenty never reads as a steady twelve.
- **Handover without a step.** A run fades over its last six hours, so the blend
  does not jump when AROME ends.
- **Families capped at half.** Runs that share a parent are not independent votes.
  A test holds every lead time under 50% per family.
- **Gusts apart.** Each model parameterises gusts in its own way, and AIFS has none.
  The gust is the upper quartile of those that give one.
- **Long range is an ensemble's job.** Beyond three days a single run is largely
  chance; the 51-member median steers it and widens the band.

## 4. The evidence for the weights

`scripts/weather-backtest.mjs` scores archived forecasts against METAR reports at
the two airports nearest Caprera, Figari (44 km) and Olbia (34 km), June to October
2026, sailing hours only. Output: `docs/working/weather-backtest.json`. Lower is
better; the mean of the two stations, in knots, or degrees for direction.

| Model         | Speed error, short range | Direction error | In W–NW wind: bias | Error at +1 d | +3 d     | +5 d     | +7 d     |
| ------------- | ------------------------ | --------------- | ------------------ | ------------- | -------- | -------- | -------- |
| AROME HD      | **2.03**                 | **18°**         | **−2.2**           | **2.40**      |          |          |          |
| AROME         | **2.02**                 | **18°**         | **−2.1**           | **2.41**      |          |          |          |
| ARPEGE        | 2.53                     | 24°             | −3.2               | 2.62          | **2.87** |          |          |
| ICON-2I       | 2.58                     | 22°             | −3.5               | 2.59          |          |          |          |
| ICON-EU       | 3.12                     | 24°             | −4.0               | 3.15          | 3.33     |          |          |
| HARMONIE DMI  | 3.00                     | 22°             | −4.0               | 3.00          |          |          |          |
| HARMONIE KNMI | 3.33                     | 22°             | −4.8               | 3.16          |          |          |          |
| IFS 9 km      | 3.34                     | 32°             | −3.9               | 3.34          | 3.53     | **3.81** | 4.41     |
| GFS           | 3.35                     | 29°             | −4.1               | 3.47          | 3.85     | 4.04     | **4.22** |
| AIFS          | 3.59                     | 40°             | −3.1               | 4.10          | 4.30     | 4.56     | 4.89     |
| UKMO          | 3.96                     | 37°             | −4.9               | 3.96          | 4.05     | 4.17     |          |
| ICON global   | 3.98                     | 28°             | −4.5               | 3.99          | 4.12     | 4.48     |          |

What this changed:

- **AROME leads the short range**, and its direction error is half that of the
  global models. That matters most in the islands.
- **ARPEGE earned its place.** At 11 km it scored better than every global and most
  high-resolution runs. Without the test it would have looked expendable.
- **Both HARMONIE runs and ICON global are out:** they cost a request column and
  scored below what they would add.
- **ECMWF is not the best here at short range,** despite its reputation; its 25 km
  and 9 km versions scored alike. Beyond day 5 GFS catches it on speed.
- **Every model reads low in westerlies.** The screen says so when a strong one is
  forecast ("guarda il valore alto"), and no correction is applied (see limits).

**Limits of this evidence, stated plainly.**

1. Airports are not the water. Both stations are on land, one season, summer and
   autumn. The ranking is evidence; the absolute errors do not transfer to Cala Fico.
2. That is why no bias correction is applied: correcting an airport's bias at sea
   would be guessing.
3. Short-range rows use archives of each model's early hours. The archive holds
   AROME at +1 d only and ICON-2I and ICON-EU to shorter leads than they reach, so
   those buckets extend their last score. The ensemble has no archive: its weight
   is a prior, not a measurement.
4. I found no published verification for the Bocche di Bonifacio itself.

Real verification needs readings from the water (§7).

## 5. Interaction: the questions asked, and the answers built

| Question                     | Choice                                                                                                                | Rejected, and why                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does it live?          | A strip above the six cards                                                                                           | A seventh card breaks the 2×3 grid and shows nothing until tapped. A bottom-bar tab would demote Avarie or Equipaggi                                                         |
| One number or a range?       | The range is the headline, with the expected value beneath                                                            | A single number is false precision at 3 days. A range alone hid the centre on first look                                                                                     |
| Traffic light, go or no-go?  | No                                                                                                                    | Whether 18 kn is fine depends on the level, the boats and the instructor. A green light from a phone would be a liability, and limits per level are not in the specification |
| Show uncertainty how?        | In words and a mark: "Modelli divisi", triangle in the week grid                                                      | Percentages imply a calibration nobody has done. Colour alone fails in sun and fails R06                                                                                     |
| Knots or Beaufort?           | Knots first, force beside them; chart grid lines fall on force boundaries but are labelled in knots                   | Mixing units on the axis was hard to read in the first version                                                                                                               |
| How do I reach a detail?     | Tap any half day: the top of the screen becomes that session, with one button back                                    | Separate detail screens multiply Back paths, a known weak spot of the app (BACKLOG, UG2-UX-4)                                                                                |
| Compare models?              | Folded table at the end                                                                                               | Open by default it pushes the answer down; hidden entirely it asks for trust                                                                                                 |
| Which arrow convention?      | Points where the wind goes, as on LaMMA's map                                                                         | Pointing to the source contradicts the map beside it                                                                                                                         |
| Cabinati vs Derive detail    | Places listed only for Cabinati                                                                                       | Three points a kilometre apart are one answer at model resolution; listing them implies a precision the grid lacks                                                           |
| Land temperature, sky icons? | Only thunder, as a warning, plus offshore waves                                                                       | The owner asked for wind. Thunder is the one non-wind fact that changes a decision on a dinghy                                                                               |
| No signal on the dock?       | The last forecast stays, with its age, and past hours drop off. Older than 6 h is marked; older than 24 h leaves Home | A blank screen is useless and a silent old forecast is dangerous                                                                                                             |

**Privacy.** The app contacts nobody for weather until the instructor first opens
Vento. After that, Home refreshes a stale forecast by itself. Requests carry the
zone's fixed coordinates and nothing else: no course, no name, no account. Providers
see the phone's IP address. The forecast lives in `localStorage`, never in the course
database: it is nobody's data, needs no backup and leaves the synced schema untouched.
The full reset clears it.

## 6. Decisions taken for you (reversal is a normal change)

1. **Side branch from `claude/0.5.0-prep`** at `4a97c1a`, because that is the current
   code. It can be rebased on whatever carries the release.
2. **No milestone registered and no contract edited** on the branch: that would
   conflict with B4–B7 in progress. §9 lists the edits for adoption.
3. **Screen name "Vento",** not "Meteo": it says what the screen is for.
4. **Compass letters are English-style (W, NW)** with the Italian name beside them
   (`NW · Maestrale`), as on LaMMA's map.
5. **Implementation routing:** the blend, data layer and screen were written by the
   orchestrating model because they are one design judgement; the browser journey
   was delegated to the Sonnet implementer, and reviewers ran on Opus (`AGENTS.md` §18).

## 7. What needs you

| #   | Item                                                 | Why                                                                                                                                                             | Default until you answer                                                                                               |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **Real session hours**                               | The specification gives sessions no clock time (`01` §7.1) and a forecast needs one                                                                             | AM 9–13, PM 14–18, one line in `windConfig.ts`                                                                         |
| 2   | **Where exactly is Cala Fico?**                      | OpenStreetMap does not name it                                                                                                                                  | Estimated at 41.178 N, 9.478 E, off Caprera's south-east. The other points come from OSM positions of the named places |
| 3   | **Are the Cabinati points right?**                   | Chosen just off each place you named; you know where boats actually go                                                                                          | As in `windConfig.ts`                                                                                                  |
| 4   | **Write to LaMMA** (info@lamma.toscana.it)           | Its licence asks that uses of its material be reported. It could also unlock the number you want most: a point series for Caprera, or a CORS header on its maps | Maps shown unaltered, credited, and the use unreported until you write                                                 |
| 5   | **Open-Meteo's free tier is for non-commercial use** | Yours is one instructor's tool, but a centre-wide deployment should check the terms: open-meteo.com/en/terms                                                    | Free tier                                                                                                              |

**The next real step in accuracy: log the wind.** One tap at the end of a session
("reale: 14 kn NW") per place would, in one season, replace the airport evidence with
measurements from the water, and show whether LaMMA, AROME or ICON-2I reads the
Bocche best. It is the only way to earn a bias correction. Not built: it adds data
to the course model and deserves its own decision.

## 8. Known limits of this build

- LaMMA is not in the numbers. Fixing that needs either LaMMA's help or a small
  server, and a backend is a non-goal (`03` §8). Reading pixel colours from its maps
  was rejected: it needs a server too, breaks on any restyle, and its CC BY-ND licence
  forbids derivatives.
- LaMMA maps need signal. Its server does not let the app read which run is out, so
  the map's time label is an estimate from the clock; the time printed on the map is
  the true one, and the screen says so.
- Waves are offshore (about 8 km grid). They say little inside Cala Fico.
- Models at 1–2 km do not resolve Isola del Porco's lee or a gap between two islands.
  Local knowledge still beats this screen, and it says so at the bottom.

## 9. To adopt it

A **FEATURE** milestone, say WX1, in 0.5.x or 0.6.0; independent of sync, so it does
not wait for B4–B7. A security and privacy review is required (new network calls).

- `01_PRODUCT_SPEC.md`: add the Vento section and the rule that it gives no go/no-go.
- `02_MVP_SCOPE.md`: add it to the road in §4.
- `03_TECHNICAL_DECISIONS.md`: add Open-Meteo and LaMMA as permitted third-party
  calls beside the speech model note; add the cache rule.
- `04_IMPLEMENTATION_PLAN.md` and `.milestones/manifest.json`: register WX1. The rule
  "Nothing connects before sign-in" concerns the backup; state that Vento is outside it.
- `docs/design/07_PAGE_CHANGELOG.md`: add the page and its Home strip.
- Move the tables' reasons from this file into `03`, and fold this document.
