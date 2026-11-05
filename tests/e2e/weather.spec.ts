import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { expectNoSidewaysScroll } from "./layout-audit"
import {
  pointsOf,
  routeWeather,
  WEATHER_HOSTS,
  WEATHER_NOW,
  windRequests,
} from "./weatherFixtures"

// Saturday 7 Nov 2026, 09:00 in Rome: the course made below is ISO week 45,
// whose first session is this afternoon. Only the wind hosts are mocked (see
// weatherFixtures.ts); the data is synthetic.
test.use({ timezoneId: "Europe/Rome", deviceScaleFactor: 1 })

const SCREENS = path.resolve("docs/working/weather-screens")
const TAKE_SCREENS = process.env.WEATHER_SCREENS === "1"

async function createCourse(
  page: Page,
  family: "Deriva" | "Cabinato",
  at = WEATHER_NOW,
) {
  await page.clock.setFixedTime(at)
  await page.goto("/")
  await page.getByRole("button", { name: family, exact: true }).click()
  await page.getByRole("button", { name: "Livello 2", exact: true }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(page.getByRole("region", { name: "Corso attivo" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /- 45 \| 2026/ }),
  ).toBeVisible()
}

const home = (page: Page) => page.getByRole("region", { name: "Corso attivo" })
const strip = (page: Page) => page.getByRole("button", { name: /^Vento/ })
const hero = (page: Page) =>
  page.getByRole("region", {
    name: /^(Prossima uscita|Scelta|In corso|Prossimo) ·/,
  })
const status = (page: Page) => page.getByRole("status").first()
const storedForecasts = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.includes("weather")),
  )

async function openVento(page: Page) {
  await strip(page).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Vento" }),
  ).toBeVisible()
}

async function backHome(page: Page) {
  await page.getByRole("button", { name: "Indietro da Vento" }).click()
  await expect(home(page)).toBeVisible()
}

async function expectKnownHero(page: Page) {
  const box = hero(page)
  await expect(
    page.getByRole("heading", { name: "Prossima uscita · Sabato PM" }),
  ).toBeVisible()
  await expect(box.getByText(/^15\s*kn$/)).toBeVisible()
  await expect(box.getByText("Raffiche 32")).toBeVisible()
  await expect(box.getByText("NW · Maestrale · Forza 4")).toBeVisible()
  await expect(box.getByText("Probabile 11–20 kn")).toBeVisible()
  // Silent when the models agree.
  await expect(box.getByText(/Modelli divisi/)).toHaveCount(0)
}

async function expectStrip(page: Page) {
  const card = strip(page)
  await expect(card).toContainText("Vento · Sab PM")
  await expect(card).toContainText("NW 15 kn")
  await expect(card).toContainText("raffiche 32")
}

async function settle(page: Page) {
  // Give a stray request every chance to appear before asserting there is none.
  await page.waitForTimeout(1500)
}

async function screenshot(page: Page, name: string, height: number) {
  await page.setViewportSize({ width: 412, height })
  await mkdir(SCREENS, { recursive: true })
  await page.screenshot({ path: path.join(SCREENS, name) })
}

test("Home stays silent; Vento asks only for the three Derive sea points", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  await settle(page)

  // Without a forecast the strip's name must not read like a direction.
  await expect(strip(page)).toHaveAccessibleName(
    "Vento. Tocca per scaricare, serve la rete",
  )
  expect(weather.requests).toEqual([])

  await openVento(page)
  await expectKnownHero(page)

  // The map is far below: nobody pays for its image until they get near it.
  await settle(page)
  expect(weather.requests.filter((url) => url.includes("lamma"))).toEqual([])

  const wind = windRequests(weather)
  expect(wind).toHaveLength(1)
  expect(pointsOf(wind[0]!)).toEqual({
    latitudes: [41.178, 41.1725, 41.167],
    longitudes: [9.478, 9.455, 9.472],
  })
  // Three data calls (wind, ensemble, sky; Derive asks no waves) and LaMMA's
  // map. Only fixed sea coordinates and model names travel: nothing of the
  // course, no account, no names.
  const data = () =>
    weather.requests.filter((url) => !url.includes("lamma.toscana.it"))
  await expect.poll(() => data().length).toBe(3)
  const allowed = new Set([
    "latitude",
    "longitude",
    "wind_speed_unit",
    "forecast_days",
    "timeformat",
    "timezone",
    "cell_selection",
    "hourly",
    "models",
  ])
  for (const request of data()) {
    const url = new URL(request)
    expect(WEATHER_HOSTS).toContain(url.hostname)
    expect(url.hash).toBe("")
    for (const key of url.searchParams.keys()) expect(allowed).toContain(key)
    expect(request).not.toMatch(/Deriva|D2|livello|corso|course/i)
  }
  await page
    .getByRole("region", { name: "Mappa LaMMA" })
    .scrollIntoViewIfNeeded()
  const maps = () =>
    weather.requests.filter((url) => url.includes("lamma.toscana.it"))
  await expect.poll(() => maps().length).toBeGreaterThan(0)
  for (const request of maps()) {
    expect([...new URL(request).searchParams.keys()]).toEqual(["run"])
  }
  expect(weather.otherOffOrigin).toEqual([])

  // The owner's source, unaltered: drawn in its own proportions.
  const shape = await page
    .locator("#mappa-lamma img")
    .evaluate(async (node) => {
      const image = node as HTMLImageElement
      await image.decode()
      return {
        natural: image.naturalWidth / image.naturalHeight,
        drawn: image.clientWidth / image.clientHeight,
      }
    })
  expect(shape.drawn).toBeCloseTo(shape.natural, 1)

  if (TAKE_SCREENS) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await screenshot(page, "vento-derive-primo-schermo.png", 915)
    await screenshot(page, "vento-derive.png", 2500)
  }
})

test("Home never connects, however old its copy, and an erased course leaves nothing", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)
  await backHome(page)
  await expectStrip(page)
  await expect.poll(() => storedForecasts(page)).toHaveLength(1)
  await settle(page)
  const before = weather.requests.length

  // Seven hours later: old enough for the screen to refresh, not for Home.
  await page.clock.setFixedTime(new Date(WEATHER_NOW.getTime() + 7 * 3_600_000))
  await page.reload()
  await expect(home(page)).toBeVisible()
  await expect(strip(page)).toContainText("dati delle 09:00")
  await settle(page)
  expect(weather.requests).toHaveLength(before)
  if (TAKE_SCREENS) await screenshot(page, "home-dati-vecchi.png", 915)

  // A day and more later it stops quoting a number and asks to be opened.
  await page.clock.setFixedTime(
    new Date(WEATHER_NOW.getTime() + 25 * 3_600_000),
  )
  await page.reload()
  await expect(strip(page)).toHaveAccessibleName(
    "Vento. Dati vecchi: tocca per aggiornare",
  )
  await settle(page)
  expect(weather.requests).toHaveLength(before)

  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await page
    .getByRole("button", { name: "Elimina il corso e inizia un nuovo corso" })
    .click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  expect(await storedForecasts(page)).toEqual([])
  await settle(page)
  expect(weather.requests).toHaveLength(before)
})

test("an answer arriving after a local reset does not bring the forecast back", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  let release: () => void = () => undefined
  weather.hold = new Promise((resolve) => {
    release = resolve
  })
  await openVento(page)
  await expect.poll(() => windRequests(weather).length).toBe(1)
  await backHome(page)

  await page.getByRole("button", { name: "Impostazioni" }).click()
  await page.getByRole("button", { name: "Azzera tutti i dati locali" }).click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: corso, preferenze e file offline saranno cancellati",
    })
    .check()
  await page.getByRole("button", { name: "Azzera i dati" }).click()
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()

  release()
  await settle(page)
  expect(await storedForecasts(page)).toEqual([])
})

test("hours that are not hours cannot lock the app, from the network or from storage", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  weather.malformed = true
  await openVento(page)
  await expect(status(page)).toContainText("Aggiornamento non riuscito")
  await expect(hero(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible()
  expect(await storedForecasts(page)).toEqual([])
  await backHome(page)

  // Reopened soon after, it still offers Riprova rather than an empty screen.
  weather.malformed = false
  await openVento(page)
  await page.getByRole("button", { name: "Riprova" }).click()
  await expectKnownHero(page)
  // A copy gone bad in storage is thrown away, and Home still opens.
  const [key] = await storedForecasts(page)
  await backHome(page)
  await page.evaluate((name) => {
    localStorage.setItem(
      name,
      JSON.stringify({ fetchedAt: 1e300, times: ["x"], points: null }),
    )
  }, key!)
  await page.reload()
  await expect(home(page)).toBeVisible()
  await expect(strip(page)).toHaveAccessibleName(/^Vento\. Tocca/)
})

test("keeps the last forecast and its age without signal", async ({
  page,
  context,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)
  await expect(status(page)).toContainText("Aggiornato alle 09:00")

  await backHome(page)
  await expectStrip(page)
  if (TAKE_SCREENS) await screenshot(page, "home.png", 915)

  // A refresh without signal keeps the numbers and says so.
  await openVento(page)
  weather.online = false
  await context.setOffline(true)
  await page.getByRole("button", { name: "Aggiorna le previsioni" }).click()
  await expect(status(page)).toContainText("Senza rete")
  await expect(status(page)).toContainText("Dati delle 09:00")
  await expectKnownHero(page)
  await context.setOffline(false)

  // Reloaded with the weather hosts unreachable: Home and Vento still show
  // the forecast and its age. The dev server has no service worker, so the
  // page itself needs the network; only the weather calls fail.
  const before = weather.requests.length
  await page.reload()
  // The app reopens on the screen it was on.
  await expectKnownHero(page)
  await expect(status(page)).toContainText("Aggiornato alle 09:00")
  await backHome(page)
  await expectStrip(page)
  await settle(page)
  // The copy is fresh, so nothing was even asked for after the reload apart
  // from the map image, which has no signal either.
  expect(
    weather.requests
      .slice(before)
      .filter((url) => !url.includes("lamma.toscana.it")),
  ).toEqual([])
})

test("a first run without signal says so, and recovers by itself when signal returns", async ({
  page,
  context,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  weather.online = false
  await context.setOffline(true)
  await openVento(page)

  await expect(status(page)).toContainText("Previsioni non scaricate.")
  await expect(
    page.getByText("Serve la rete per la prima previsione"),
  ).toBeVisible()
  await expect(hero(page)).toHaveCount(0)
  if (TAKE_SCREENS) await screenshot(page, "vento-senza-rete.png", 915)

  weather.online = true
  await context.setOffline(false)
  await expectKnownHero(page)
  await expect(page.getByRole("button", { name: "Riprova" })).toHaveCount(0)
})

test("when the service fails Riprova downloads, and focus does not vanish with it", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  weather.online = false
  await openVento(page)
  await expect(
    page.getByText("Il servizio meteo non ha risposto"),
  ).toBeVisible()

  weather.online = true
  await page.getByRole("button", { name: "Riprova" }).click()
  await expectKnownHero(page)
  await expect(page.getByRole("button", { name: "Riprova" })).toHaveCount(0)
  await expect(
    page.getByRole("heading", { level: 2, name: /Sabato PM/ }),
  ).toBeFocused()
})

test("a place not yet downloaded does not hide the one that was", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)

  weather.online = false
  const area = page.getByRole("group", { name: "Area" })
  await area.getByRole("button", { name: "Cabinati" }).click()
  await expect(page.getByText("Cabinati non ancora scaricato.")).toBeVisible()
  await page.getByRole("button", { name: "Torna a Derive" }).click()
  await expectKnownHero(page)
})

test("a tap on the week shows that half-day above, and the horizon moves only the week", async ({
  page,
}) => {
  await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)
  const week = page.getByRole("region", { name: "La settimana" })

  // Models divided: it says over what.
  await week.getByRole("button", { name: /^Domenica 8 AM:/ }).click()
  await expect(
    page.getByRole("heading", { name: "Scelta · Domenica AM" }),
  ).toBeVisible()
  await expect(
    hero(page).getByText("Modelli divisi: NW 20 o SE 6"),
  ).toBeVisible()
  await expect(
    week.getByRole("button", { name: /^Domenica 8 AM:/ }),
  ).toHaveAccessibleName(/Modelli divisi\.$/)
  if (TAKE_SCREENS) await screenshot(page, "vento-modelli-divisi.png", 915)

  // Thunder: named in words as well as drawn.
  await week.getByRole("button", { name: /^Domenica 8 PM:/ }).click()
  await expect(
    page.getByRole("heading", { name: "Scelta · Domenica PM" }),
  ).toBeVisible()
  await expect(hero(page).getByText("Temporali possibili")).toBeVisible()

  // Beyond three days it is only a tendency, and says so.
  await week.getByRole("button", { name: /^Martedì 10 PM:/ }).click()
  await expect(hero(page).getByText(/^~10\s*kn$/)).toBeVisible()
  await expect(
    hero(page).getByText("Oltre 3 giorni: solo una tendenza."),
  ).toBeVisible()
  await expect(hero(page).getByText(/Modelli divisi/)).toHaveCount(0)

  // Beyond five days no gust number, and no pretence of skill.
  await week.getByRole("button", { name: /^Giovedì 12 PM:/ }).click()
  await expect(hero(page).getByText("Raffiche: troppo presto")).toBeVisible()
  await expect(
    hero(page).getByText(/vale poco più della media di stagione/),
  ).toBeVisible()

  await hero(page)
    .getByRole("button", { name: "Torna alla prossima uscita" })
    .click()
  await expectKnownHero(page)
  await expect(
    page.getByRole("button", { name: "Torna alla prossima uscita" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Prossima uscita · Sabato PM" }),
  ).toBeFocused()

  // Seven days start from today; the session above stays where it was.
  await page
    .getByRole("group", { name: "Orizzonte" })
    .getByRole("button", { name: "7 giorni" })
    .click()
  const seven = page.getByRole("region", { name: "Prossimi 7 giorni" })
  await expect(seven).toBeVisible()
  await expect(
    seven.getByRole("button", { name: /^Sabato 7 AM:/ }),
  ).toBeVisible()
  await expectKnownHero(page)

  await page.goBack()
  await expect(home(page)).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 1, name: "Vento" }),
  ).toHaveCount(0)
})

test("a number in the week is never broken across lines, chosen or not, and cells stay tappable", async ({
  page,
}) => {
  await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)
  const week = page.getByRole("region", { name: "La settimana" })
  await week.getByRole("button", { name: /^Mercoledì 11 AM:/ }).click()

  for (const width of [320, 344, 360, 390, 412]) {
    for (const scale of [100, 105, 110, 115, 120, 125, 150, 200]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${value}%`
      }, scale)
      const found = await page.evaluate(() => {
        const cells = [
          ...document.querySelectorAll<HTMLElement>("button.wind-cell"),
        ]
        const broken = cells.flatMap((cell) =>
          [...cell.querySelectorAll("span")].flatMap((span) => {
            const range = document.createRange()
            range.selectNodeContents(span)
            const lines = new Set(
              [...range.getClientRects()].map((box) => Math.round(box.top)),
            )
            return span.textContent && lines.size > 1 ? [span.textContent] : []
          }),
        )
        return {
          broken,
          narrowest: Math.min(
            ...cells.map((cell) => cell.getBoundingClientRect().width),
          ),
        }
      })
      expect(found.broken, `${width} px, ${scale}%`).toEqual([])
      expect(found.narrowest, `${width} px, ${scale}%`).toBeGreaterThanOrEqual(
        40,
      )
    }
  }
})

test("Home does not quote a far forecast as firmly as tomorrow's", async ({
  page,
}) => {
  await routeWeather(page)
  // Monday 2 Nov: the first session is more than three days ahead.
  await createCourse(page, "Deriva", new Date("2026-11-02T09:00:00+01:00"))
  await openVento(page)
  await expect(hero(page).getByText(/^~/)).toBeVisible()
  await backHome(page)
  await expect(strip(page)).toContainText("solo tendenza")
  await expect(strip(page)).toContainText("~")
})

test("the jump to the map takes focus with it, and a self-removing button leaves it on the section", async ({
  page,
}) => {
  await routeWeather(page)
  await createCourse(page, "Deriva", new Date("2026-11-07T15:00:00+01:00"))
  await openVento(page)
  await hero(page).getByRole("button", { name: "Mappa LaMMA" }).click()
  await expect(page.getByRole("heading", { name: "Mappa LaMMA" })).toBeFocused()

  await hero(page)
    .getByRole("button", { name: /^Dopo · Dom AM:/ })
    .click()
  await expect(
    page.getByRole("heading", { name: "Scelta · Domenica AM" }),
  ).toBeFocused()
})

test("during a session the screen says so and offers what comes after", async ({
  page,
}) => {
  await routeWeather(page)
  await createCourse(page, "Deriva", new Date("2026-11-07T15:00:00+01:00"))
  await openVento(page)

  await expect(
    page.getByRole("heading", { name: "In corso · Sabato PM" }),
  ).toBeVisible()
  await hero(page)
    .getByRole("button", { name: /^Dopo · Dom AM:/ })
    .click()
  await expect(
    page.getByRole("heading", { name: "Scelta · Domenica AM" }),
  ).toBeVisible()
})

test("a Cabinato course opens on Cabinati with its places and waves; Derive has neither", async ({
  page,
}) => {
  const weather = await routeWeather(page)
  await createCourse(page, "Cabinato")
  await openVento(page)

  const area = page.getByRole("group", { name: "Area" })
  await expect(area.getByRole("button", { name: "Cabinati" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(
    page.getByRole("heading", { name: "Prossima uscita · Sabato PM" }),
  ).toBeVisible()

  let wind = windRequests(weather)
  expect(wind).toHaveLength(1)
  expect(pointsOf(wind[0]!)).toEqual({
    latitudes: [41.24, 41.265, 41.215, 41.168, 41.148, 41.125],
    longitudes: [9.325, 9.41, 9.5, 9.465, 9.53, 9.445],
  })
  await expect
    .poll(
      () => weather.requests.filter((url) => url.includes("marine-api")).length,
    )
    .toBe(1)
  await expect(hero(page).getByText(/Onda al largo 0,5 m/)).toBeVisible()

  // Open by itself because the places differ by three knots.
  await expect(hero(page).getByText("Nell'area: 15–18 kn")).toBeVisible()
  const rows = hero(page).locator("details li")
  for (const label of [
    "Spargi",
    "La Maddalena nord",
    "Caprera est",
    "Caprera sud",
    "Liscia di Vacca",
    "Cannigione",
  ]) {
    await expect(rows.filter({ hasText: label })).toHaveCount(1)
  }
  await expect(rows.filter({ hasText: "Spargi" })).toContainText("18 kn")
  await expect(rows.filter({ hasText: "Spargi" })).toContainText("r 38")
  await expect(rows.filter({ hasText: "Cannigione" })).toContainText("15 kn")
  await expect(rows.filter({ hasText: "Cannigione" })).toContainText("r 32")
  // A difference between places is not a disagreement between models.
  await expect(hero(page).getByText(/Modelli divisi/)).toHaveCount(0)

  if (TAKE_SCREENS) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await screenshot(page, "vento-cabinati.png", 2700)
  }

  await area.getByRole("button", { name: "Derive" }).click()
  await expect(area.getByRole("button", { name: "Derive" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(
    page.getByText("Cala Fico, Isola del Porco, Punta Rossa"),
  ).toBeVisible()
  await expectKnownHero(page)
  await expect(hero(page).getByText(/Nell'area/)).toHaveCount(0)
  await expect(hero(page).getByText(/Onda/)).toHaveCount(0)
  wind = windRequests(weather)
  expect(wind).toHaveLength(2)
  expect(pointsOf(wind[1]!)).toEqual({
    latitudes: [41.178, 41.1725, 41.167],
    longitudes: [9.478, 9.455, 9.472],
  })
})

test("with reduced motion the jump to the map arrives at once", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await routeWeather(page)
  await createCourse(page, "Deriva")
  await openVento(page)
  await expectKnownHero(page)
  await hero(page).getByRole("button", { name: "Mappa LaMMA" }).click()
  const top = await page.evaluate(
    () => document.getElementById("mappa-lamma")!.getBoundingClientRect().top,
  )
  expect(top).toBeLessThan(200)
})

for (const { width, textScale } of [
  { width: 320, textScale: 100 },
  { width: 412, textScale: 100 },
  { width: 320, textScale: 200 },
  { width: 390, textScale: 200 },
  { width: 412, textScale: 200 },
]) {
  test(`no sideways scroll at ${width} px and ${textScale}% text; a failed LaMMA map leaves the rest intact`, async ({
    page,
  }) => {
    const weather = await routeWeather(page)
    weather.lamma = false
    await page.setViewportSize({ width, height: 800 })
    await createCourse(page, "Deriva")
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`
    }, textScale)
    await openVento(page)
    await expectKnownHero(page)

    const chart = page.getByRole("region", { name: /^Prossime 24 ore/ })
    await chart.scrollIntoViewIfNeeded()
    await expect(chart.getByRole("img")).toBeVisible()
    await chart.getByText("Ora per ora").click()
    await expect(chart.locator("details li")).toHaveCount(25)
    const week = page.getByRole("region", { name: "La settimana" })
    await week.scrollIntoViewIfNeeded()
    await expect(
      week.getByRole("button", { name: /^Sabato 7 PM:/ }),
    ).toBeVisible()
    await expectNoSidewaysScroll(page, `Vento at ${width} px, ${textScale}%`)
    if (TAKE_SCREENS && width === 320) {
      await page.setViewportSize({
        width,
        height: textScale === 200 ? 3600 : 2300,
      })
      await page.evaluate(() => window.scrollTo(0, 0))
      await mkdir(SCREENS, { recursive: true })
      await page.screenshot({
        path: path.join(SCREENS, `vento-${width}-${textScale}.png`),
      })
      await page.setViewportSize({ width, height: 800 })
    }

    await page
      .getByRole("region", { name: "Mappa LaMMA" })
      .scrollIntoViewIfNeeded()
    await expect(page.getByText(/^Mappa non caricata/)).toBeVisible()
    await page.getByText("Modelli e pesi").click()
    await expect(page.getByText(/AROME/).first()).toBeVisible()
    await expectNoSidewaysScroll(
      page,
      `Vento with a failed map at ${width} px, ${textScale}%`,
    )

    // Everything else on the screen is still there.
    await hero(page).scrollIntoViewIfNeeded()
    await expect(hero(page).getByText("NW · Maestrale · Forza 4")).toBeVisible()
    await expect(chart.getByRole("img")).toBeVisible()
    await expect(
      week.getByRole("button", { name: /^Sabato 7 PM:/ }),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: /^Windy/ })).toBeVisible()
  })
}
