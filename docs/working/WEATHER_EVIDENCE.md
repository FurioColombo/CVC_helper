# Vento — evidence and reviews

> Working document · Owner: the owner · Fold at: 0.6.0

The figures behind `WEATHER_PROPOSAL.md` and what each round of review changed. Source
data: `weather-backtest.json`, written by `scripts/weather-backtest.mjs`. Reports:
`weather-reviews/`.

## 1. The evidence for the weights

The first backtest scored models against two airports' METAR on land cells. The
method reviewer showed it could not support weights for open water: land stations
favour models that see land the same way. `scripts/weather-backtest.mjs` was
rewritten. It now uses **exposed capes** on **sea cells**: Cap Pertusato (107 m) and
La Chiappa (57 m), Météo-France hourly open data, Licence Ouverte, June to October
2026, sailing hours, one common sample per comparison. Airports stay as a control.
Output: `docs/working/weather-backtest.json`.

Mean hourly speed error at +1 day, knots, common sample:

| Site | AROME | IFS  | ARPEGE | GFS  | ICON-2I | ICON-EU | UKMO | AIFS |
| ---- | ----- | ---- | ------ | ---- | ------- | ------- | ---- | ---- |
| PERT | 2.67  | 2.88 | 3.09   | 3.18 | 3.20    | 3.33    | 3.44 | 4.17 |
| CHIA | 3.25  | 3.82 | 3.48   | 3.87 | 3.42    | 4.34    | 3.84 | 3.95 |

The blend itself, computed by the app's own domain code, on sessions with all seven
models (session windows 9–13 and 14–18, before the owner widened them to 8–14 and 14–19
on 2026-11-12; the hourly figures do not depend on them) (the second build's table had let in sessions without them, and said otherwise).
+1 d covers August to October only, 171 sessions; short range covers 306. The session
error compares session means; the hourly one is comparable with the table above.

| Site, lead | Inside range | Above range | Width kn | Session error | Hourly error | Gust bias | Gust passed | Division |
| ---------- | ------------ | ----------- | -------- | ------------- | ------------ | --------- | ----------- | -------- |
| PERT short | 81%          | 9%          | 7.8      | 1.78          | 2.28         | +2.3      | 25%         | 3%       |
| PERT +1 d  | 79%          | 12%         | 8.0      | 1.90          | 2.44         | +1.5      | 32%         | 8%       |
| CHIA short | 77%          | 19%         | 7.1      | 1.94          | 2.55         | +0.5      | 42%         | 15%      |
| CHIA +1 d  | 70%          | 24%         | 7.2      | 2.48          | 3.07         | −0.4      | 52%         | 20%      |

By the wind the screen expected, at +1 d. The strong-wind rows are small, and the
headline figures above are dominated by light wind:

| Expected | PERT sessions | Inside | Gust passed | CHIA sessions | Inside | Gust passed |
| -------- | ------------- | ------ | ----------- | ------------- | ------ | ----------- |
| Under 12 | 95            | 77%    | 42%         | 135           | 75%    | 54%         |
| 12–16    | 45            | 86%    | 9%          | 21            | 51%    | 38%         |
| From 16  | 31            | 76%    | 35%         | 15            | 57%    | 53%         |

Those rows are thinner than they look. La Chiappa at +1 d from 16 kn is 15 sessions on 11
days, 7 separate episodes: inside 57%, with a 90% interval of 33–85. From 12 kn more than
half of La Chiappa's sessions at +1 d fall in one October, when inside was 42%, and in other
months it was 59–88%. So the screen's "5-6" is largely one October at one cape. Those misses
are one-sided: 36–42% of hours above the top and 5–6% below, because the centre reads low
there. Pertusato is balanced.

**The new weights did not improve the centre.** Session error at +1 d was 1.90 and 2.43
with the first build's weights, 1.90 and 2.48 now; AROME alone gives 2.07 and 2.61. What
improved is the range and the gust, and blending beats the best single model by about
0.2 kn. La Chiappa from 12 kn, where the real wind is above the range over a third of
the time, is the weakest result: there "Probabile" is no upper limit.

**Why a gust factor of 2.** Passed and bias are given for all sessions and for those from
16 kn. These come from a side run, recomputed by the third reviewer; the script has no sweep
and the JSON holds only the factor shipped. Adding it is listed for adoption.

| Factor | Passed, all | Passed, from 16 kn | Bias, all    | Bias, from 16 kn |
| ------ | ----------- | ------------------ | ------------ | ---------------- |
| 1.6    | 71–75%      | 87–97%             | −1.4 to −2.3 | −3.8 to −6.7     |
| 1.8    | 49–68%      | 55–74%             | +0.2 to −1.6 | −1.2 to −3.3     |
| 2      | 25–52%      | 22–53%             | −0.4 to +2.3 | −0.4 to +2.9     |

**What this number is.** Twice the expected wind sets it in 71–78% of sessions, and from 16 kn
in 75–100%; there it stands about 6–10 kn above the highest model. It is a doubling far more
often than a model's forecast. It is also weakly identified. Passed at +1 d under 12, 12–16
and from 16 kn is 42, 9, 35 at Pertusato and 54, 38, 53 at La Chiappa, so it is not the same at
every strength. Moving the factor from 1.9 to 2.1 takes the from-16 rate from 37 to 8, 48 to
16, 60 to 25 and 53 to 13 across the four rows, and the two capes want different factors. So
"3-5 uscite su 10" is true of this sample and could move a long way on another season or site.

**The trade.** At the capes the number was at or above the real peak in 48–75% of sessions. With
30 kn or more shown, the peak stayed under 30 in about a third of sessions, against 8–10% with
1.6. In exchange a 30 kn peak was foreseen 85–88% of the time, against 51–54%. It was fitted to
peaks on headlands, and nothing here measures the water. The screen now says both sides.

**Beyond +1 d** the archive has speeds only and no ensemble, so these are floors for the
range, not scores of what ships. On the same 171 sessions as the +1 d rows, recomputed by the
third reviewer; the JSON's own rows use all 306 sessions and a model count that changes in
August, which made La Chiappa at d2 look better than at +1 d. Hours inside, then hourly error:

| Site | d2        | d3        | d5        | d7        | Constant mean with hindsight |
| ---- | --------- | --------- | --------- | --------- | ---------------------------- |
| PERT | 73%, 2.87 | 72%, 3.23 | 65%, 4.20 | 61%, 4.84 | 5.09                         |
| CHIA | 69%, 3.21 | 66%, 3.59 | 61%, 4.25 | 56%, 4.90 | 5.36                         |

The gust has no archive that far. As a bound, the doubling alone was passed 50–53% of the time at
Pertusato and 65–72% at La Chiappa from d2 to d5, so expect about 5 and 6–7 in 10.

As a control, the airports at +1 d: Figari 59% inside, session error 2.42, gust passed
14%; Olbia 70%, 2.03, 25%. Land reads differently, as expected.

What this changed from the first proposal, and it retracts three things it said:

- **"ECMWF is not the best here" is withdrawn.** On sea cells IFS is second at PERT
  at +1 d, and at 7 days it beats GFS at both capes (5.41 vs 6.10; 4.55 vs 5.80).
- **"GFS catches it beyond day 5" is withdrawn**, for the same reason.
- **"Every model reads low in westerlies" is withdrawn.** It came from airports.
- **AROME still leads at short range**, and ICON-2I is close behind it at La Chiappa.
  The second build called that site "nearest in kind" to the Bocche; nothing shows that,
  and the claim is withdrawn.
- **No bias correction**: there are no readings from the water to base one on.

**Limits, stated plainly.**

1. Capes are not Cala Fico. They are the nearest exposed open data, both in south
   Corsica, 33 and 47 km off, at 57 and 107 m, one season. The ranking is evidence; the
   errors do not transfer.
2. The archive holds some models only to shorter leads than they reach, and the
   ensemble has no archive: its weight is a prior, not a measurement.
3. Every tuned number was tuned on the season it is scored on: the range scale, the gust
   factor, the 120 h cut and the weights. Expect them to do worse on a new one, and how much is not known.
   Direction is scored nowhere beyond +1 d. "Seven models" holds for speed: at +1 d the
   archive gives gusts for five, without IFS and AIFS. Removing IFS at short range changed
   the passed rate by at most 0.3 points. The backtest's slices never reach a run's fade,
   measured apart and harmless. A rerun of the script needs Prettier on its JSON.
4. Cabinati's gust is the highest across its places, so it reads higher than what was
   tested at a single point.
5. I found no published verification for the Bocche itself. Real verification needs
   readings from the water (§7).

## 2. What the reviews changed

**Round one**, at `de89666`. UI FAIL, accessibility FAIL, field UX FAIL, method FAIL, security
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

**Round two**, at `01e1ca0`, four reviewers. Reports named `round2-*`. Field UX FAIL, method
FAIL, security and accessibility PASS_WITH_FINDINGS.

| Reviewer      | What it proved                                                                                                             | What changed                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Method        | The evidence averaged away strong wind: from 16 kn the range held half the hours and the gust was passed 9 times in 10     | Range and gust grow with the wind; table by strength; the screen says what holds and what does not       |
| Method        | "+1 d" was not the blend shipped: 44% of sessions lacked two models                                                        | True seven-model sample, 171 sessions; hourly and session errors kept apart; "centre improved" withdrawn |
| Field UX      | My square box stretched LaMMA's map by 42%, and a stub image hid it                                                        | Real proportions; a non-square stub; a journey compares drawn and natural ratio                          |
| Field UX      | `~24` could break into two lines in a cell, on the strongest far days                                                      | Numbers cannot break; a journey checks five widths at eight text sizes, with the widest values           |
| Field UX      | What was seen could be lost on leaving; a return restarted a running download; "Aggiornato" shown while updating or failed | Kept at once; a run is never restarted; the age says "Dati delle" then                                   |
| Field UX      | Nothing explained the chart or arrows; Home quoted a far forecast as firmly as tomorrow's                                  | A line of words under the chart; `~` and "solo tendenza" on Home; thunder unknown is said                |
| Security      | The screen and gate said "tapping", but an open Vento connects by itself; a far map image loaded unasked                   | Wording corrected; map fetched only near the screen; another tab's erase stops a running refresh         |
| Accessibility | Cells 36 px at 320; announcements lost thunder and division; failure text unannounced                                      | 40 px and more; one spoken sentence everywhere; a live region always mounted; focus follows the map jump |

**Round three**, at `f735e2c`, a narrow look at round two's four blockers. Reports named
`round3-*`. Both PASS_WITH_FINDINGS, no blockers. Each tried to falsify the claim, and the field
reviewer put the old faults back to prove the new tests catch them.

| Reviewer | What it proved                                                                                     | What changed                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Method   | The figures match the data, but the gust is usually a doubling, and the screen warned one way only | The screen says it is usually the double, fitted to capes, and may read high; far gusts wear `~`   |
| Method   | "About the same at every strength" and the bias column did not hold; d2–d7 used a different sample | Corrected above, with the sample, the October weight and how sensitive the factor is               |
| Field UX | Leaving during the extras left a part copy counted as fresh for 45 minutes                         | A copy without sky or ensemble is due again after 5 minutes                                        |
| Field UX | Carrying a sky reset its age, so a 20-hour-old sky could read as news                              | Each extra keeps its own time; it is carried for 6 hours from when it was really fetched           |
| Field UX | My inset selection wiped the focus ring; the week jumped 24 px when a refresh ended; "Torna" 37 px | Both shadows on a focused chosen cell; a one-line refreshing text, same padding; 44 px             |
| Field UX | The wave map is 1181 wide, not 1168, and three fixes had no journey                                | The image's own ratio once loaded; journeys for the wave map, no map on a tap, and the scroll back |

**Round four**, at `27d3554` plus the owner's additions of 2026-11-12 (hours around the outing,
the map, sky and temperature; checkpoint `b3036da`). Reports named `round4-*`. Field UX FAIL,
accessibility FAIL.

| Reviewer      | What it proved                                                                                    | What changed                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Field UX      | At 320 px and 200 % the six-hour morning ran its numbers together and the hour buttons overlapped | The row wraps at 2.75rem a cell; a journey audits Sunday morning at every size, both views                  |
| Field UX      | The wider window moved every headline to unsailed hours and kept the morning on Home until 13:00  | The outing's hours make the numbers; the window only shows them, muted; a 12:40 journey and test cases      |
| Field UX      | Sky before thunder; map text 11–14 px; names over a neighbour's number; two "Mappa" in one card   | Thunder first, sky lighter; floors 16 and 13 px; markers and names placed apart; the jump is "LaMMA"        |
| Field UX      | Mappa dropped the likely range, waves and places; thirteen sky icons in the week; Torna by Mappa  | Range and waves under the map, places listed; icons only when wet, red bolt on a chip; Torna on its own row |
| Accessibility | If the map's file failed, the whole screen showed an error and the stored forecast was deleted    | The map has its own error boundary and retry; a journey aborts the file and checks the forecast stays       |
| Accessibility | The map's values reached nobody at their text size; the focused hour vanished; picks were silent  | A list under the map; focus moves to the hour shown; each pick announced with every place's wind            |
| Accessibility | Clear markers let the coast run through numbers; "raffiche"/"raffica", "da Variabile"; view lost  | White below 11 kn; one wording (`readingInWords`); loading announced; the view remembered; 44 px switch     |

**Not reviewed.** The fixes to rounds three and four are covered only by my own tests. No reviewer
has seen them; the adoption milestone's reviews should. Routing: the orchestrator wrote all fixes;
reviewers ran on Opus, the method one as a general-purpose agent on Opus.
