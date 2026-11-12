# Vento — the wind forecast

Part of the product specification (`01_PRODUCT_SPEC.md` §2): what Vento shows
and the rules of its numbers. Its network calls, refresh and offline copy are
`03_TECHNICAL_DECISIONS.md` §3.4.

## What it answers

Vento answers one question on the dock, in a hurry: what wind will we have when
we go out, and is there a reason to doubt it? It never says whether to go out:
that stays the instructor's decision. There is no traffic light, no go or no-go
and no limit per level.

## Home

A full-width Vento line sits above Home's six cards. It quotes the next outing
from the last download: direction, expected wind and gust in knots, the sky and
its temperatures, and thunder when forecast. It contacts nobody. From 6 hours
it shows the copy's age; from 24 hours, or with no copy, it says
`Dati vecchi: tocca per aggiornare` or `Tocca per scaricare, serve la rete`
instead of a number. A tap opens the Vento screen.

## The screen

In order: the next outing; the week; the next 24 hours; LaMMA's map; the models
and their weights; links to other sources (Meteomar first, as the official
bulletin, then LaMMA, Windy, Windfinder). The screen states what it connects to
and the copy's age, and offers `Aggiorna`.

- **Next outing.** Expected wind and gust large; direction with its Italian
  name and force; the likely range below, labelled `Probabile`; thunder; sky and
  temperatures; a change during the outing; division between models, named in
  numbers or not at all; hour by hour. `Numeri` and `Mappa` switch between the
  hours and a map of the area drawn from OpenStreetMap's coastline, each point's
  wind at the hour picked, with the list of places under it.
- **Places.** Cabinati shows each place's wind, opening by itself when places
  differ by 3 kn or more. Derive's points are one answer at model resolution.
- **Week.** One grid, a column per day, AM and PM: direction letter, knots,
  gust, highest temperature, an icon only when wet, one blue deepening with the
  wind. A tap shows that half-day in the section above, announced; one button
  returns to the next outing.
- **Next 24 hours.** One chart without sideways scroll: expected wind, likely
  band, gusts, outings named with their day.

**Areas** follow the course: Deriva opens on Cala Fico, Isola del Porco and
Punta Rossa; Cabinato on Caprera, La Maddalena, Spargi, Cannigione and Liscia
di Vacca. A switch shows the other area. **Horizon:** `Settimana` is what
remains of the course's sessions, the default from seven days before the course
until its last session ends; `7 giorni` is every half-day from now.

**Outings.** The morning outing is 9:00–12:30 and the afternoon 15:00–18:00
(owner, 2026-11-12). Every number said about an outing comes from those hours,
and so do "In corso" and the moment the next outing becomes the answer; an
outing in its last hour gives way to the next. The hour row and the map show
8–14 and 14–19, the extra hours greyed and read as before or after the outing.

## The numbers

Seven models are blended by weights that change with lead time
(`src/domain/windConfig.ts`): AROME HD, ICON-2I, ARPEGE, ICON-EU, IFS, AIFS and
GFS, with the ECMWF ensemble median at long range. Each asks for the nearest
sea cell.

- The centre is a weighted median, each model counted once after averaging its
  points, so one model far from the rest moves it little.
- The likely range is at least ±3 kn and at least ±30% of the expected wind,
  wider when the models disagree. It is no upper limit.
- The gust is twice the expected wind, or the highest model's gust if higher.
  It is no ceiling, and over water it may read high.
- Division is named only within 3 days: by direction ("Modelli divisi: NW 20 o
  SE 6") or by strength, with the range in words.
- Beyond 3 days a number wears `~` and is called a trend; beyond 5 days the
  screen says it is worth little more than the seasonal mean, and no gust is
  printed.
- Lead time counts from the download, so an old copy keeps its caution. Weights
  are continuous, so neither number steps when a model's run ends.
- Sky and temperature come from one point at the area's centre: a half-day
  shows its worst rain, fog or storm, else its most frequent cloud, and its
  lowest and highest temperature.

LaMMA's maps are shown unaltered and never read into the numbers. Local
knowledge beats this screen, and the screen says so.

## Without signal

The last forecast stays with its age and past hours drop off. From 6 hours it
is marked old; from 24 Home stops quoting it. Erasing, replacing or importing
the course and a local reset remove it.
