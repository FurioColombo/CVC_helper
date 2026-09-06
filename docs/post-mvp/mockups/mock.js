/* global document, location, history, setTimeout, clearTimeout, Event */
/* Design-only prototype. Synthetic data, memory-only interactions, no app imports. */
const pages = [
  [
    "P01",
    "Home",
    "Un ingresso riconoscibile, sei scelte chiare.",
    "Il marchio dà identità senza diventare un dashboard?",
  ],
  [
    "P02",
    "Crea corso",
    "Poche scelte note, etichetta generata.",
    "Campi, conferma e riepilogo restano comodi sul piccolo?",
  ],
  [
    "P03",
    "Allievi",
    "Più nomi visibili, con età e stati essenziali.",
    "Due colonne distinguono bene omonimi e nomi lunghi?",
  ],
  [
    "P04",
    "Profilo allievo",
    "Dati e conoscenza nello stesso percorso, con le note recenti in evidenza.",
    "Il riepilogo settimanale dentro Valutazioni è utile già dal profilo?",
  ],
  [
    "P05",
    "Conoscenza",
    "Taglia con un tap, nota vicino al nome.",
    "I nomi restano su una riga e la nota si detta nello stesso pannello?",
  ],
  [
    "P06",
    "Scan allievi",
    "Guidare l'inquadratura prima di chiedere al motore di leggere.",
    "Il rettangolo e il crop chiariscono quali colonne servono?",
  ],
  [
    "P07",
    "Configura barche",
    "Inserimento raro e semplice, separatori flessibili.",
    "Si capisce subito quali barche vengono aggiunte?",
  ],
  [
    "P08",
    "Barche",
    "Numero, tipo, guasto e disponibilità leggibili insieme.",
    "Da controllare è giallo; Disponibile resta neutro e leggibile?",
  ],
  [
    "P09",
    "Avarie",
    "Commento utile e cambio stato diretto.",
    "La preview a tre righe è abbastanza lunga?",
  ],
  [
    "P10",
    "Volontari",
    "Un nome e un ruolo, senza spiegazioni permanenti.",
    "CT è visibile e coerente con ADV e IS?",
  ],
  [
    "P11",
    "Comandate",
    "Sette gruppi da confrontare nello stesso sguardo.",
    "Le card con pochi nomi partono dall'alto come le altre? Prova gli avvisi.",
  ],
  [
    "P12",
    "Proposta Comandate",
    "Preferenze e conteggi live nello stesso riquadro.",
    "Base uguale e giorni con una persona in più sono chiari prima di generare?",
  ],
  [
    "P13",
    "Persone Comandata",
    "Due allievi per riga, con giorni abbreviati dentro card compatte.",
    "Le due card per riga restano leggibili e associano chiaramente ogni X al suo giorno?",
  ],
  [
    "P14",
    "Equipaggi",
    "Persone disponibili e destinazioni vicine.",
    "Il popup barche conserva ordine numerico e stati grigio, verde e blu?",
  ],
  [
    "P15",
    "Barche della sessione",
    "Tutte le barche dell'uscita visibili in due righe, anche con numeri a due cifre.",
    "Grigio non disponibile, verde assegnata e blu libera guidano l'assegnazione?",
  ],
  [
    "P16",
    "Leggi equipaggi",
    "Solo ciò che serve per leggere ad alta voce.",
    "Il logo più grande resta distinto da numero equipaggio e persone?",
  ],
  [
    "P17",
    "Valutazioni",
    "Nome e cinque valutazioni dirette sulla stessa riga.",
    "La riga resta rapida da leggere e le cinque icone sono distinguibili anche sullo schermo stretto?",
  ],
  [
    "P18",
    "Riepilogo",
    "Sequenza, note e numero di voti; niente media numerica.",
    "L'intestazione più bassa lascia più spazio alla settimana senza perdere il nome?",
  ],
  [
    "P19",
    "Storia allievo",
    "Soggetto persistente, riepilogo immediato e cronologia per giorno.",
    "Il riepilogo in alto e le card più basse rendono la storia più rapida da leggere?",
  ],
]
const people = [
  ["Giulia", "Moretti", 17, "F", "S"],
  ["Luca B.", "Bianchi", 24, "M", "M"],
  ["Anna", "Riva", 26, "F", "M"],
  ["Davide", "Conti", 31, "M", "L"],
  ["Marco", "Galli", 22, "M", "M"],
  ["Sara", "Ferrari", 27, "F", "S"],
  ["Elena", "Rossi", 20, "F", "M"],
  ["Paolo", "Costa", 36, "M", "L"],
  ["Luca R.", "Romano", 29, "M", "XL"],
  ["Sofia", "Ricci", 16, "F", "XS"],
  ["Andrea", "Marini", 28, "Altro", "M"],
  ["Chiara", "Greco", 25, "F", "S"],
  ["Matteo", "Bruno", 33, "M", "L"],
  ["Alice", "Villa", 23, "F", "S"],
  ["Carlo", "Fabbri", 41, "M", "M"],
  ["Marta", "Serra", 30, "F", "M"],
  ["Nicolò", "Lombardi", 21, "M", "L"],
  ["Irene", "Leone", 32, "F", "M"],
  ["Francesca", "De Santis", 24, "F", "S"],
  ["Alessandro", "Della Valle", 28, "M", "L"],
  ["Pietro", "Testa", 34, "M", "M"],
  ["Valentina", "Fontana", 27, "F", "S"],
  ["Tommaso", "Sala", 26, "M", "M"],
].map((p, id) => ({
  id,
  name: p[0],
  surname: p[1],
  age: p[2],
  sex: p[3],
  size: p[4],
}))
const staff = [
  { id: 100, name: "Federico", role: "CT" },
  { id: 101, name: "Beatrice", role: "IS" },
  { id: 102, name: "Giorgio", role: "ADV" },
]
const days = [
  "Sabato",
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
]
const shortDays = ["S", "D", "L", "Ma", "Me", "G", "V"]
const dutyDayShort = ["Sab", "Dom", "Lun", "Mar", "Mer", "Gio", "Ven"]
const marks = ["++", "+", "=", "-", "--"]
const sessions = [
  "Sab PM",
  "Dom AM",
  "Dom PM",
  "Lun AM",
  "Lun PM",
  "Ma AM",
  "Ma PM",
  "Me AM",
  "Me PM",
  "Gio AM",
  "Gio PM",
  "Ven AM",
  "Ven PM",
]
const boatNumbers = [2, 3, 7, 8, 11, 14, 15]
const boatTypes = [
  "RS Quest",
  "RS 500",
  "Laser Vago",
  "RS Toura",
  "J/80",
  "First 25.7",
  "First 27",
]
const boatTypeByNumber = {
  2: "RS Quest",
  3: "RS 500",
  7: "Laser Vago",
  8: "RS Toura",
  11: "J/80",
  14: "First 25.7",
  15: "First 27",
}
const boatLogoFiles = {
  "RS Quest": "assets/rs-quest-complete.png",
  "RS 500": "assets/boat-rs-500.png",
  "Laser Vago": "assets/boat-laser-vago.png",
  "RS Toura": "assets/boat-rs-toura.png",
  "J/80": "assets/boat-j80.png",
  "First 25.7": "assets/boat-first-25-7.png",
  "First 27": "assets/boat-first-27.png",
}
const boatType = (number) => boatTypeByNumber[number] || "RS Quest"
const boatLogo = (type) =>
  `<img class="boat-brand" src="${boatLogoFiles[type] || boatLogoFiles["RS Quest"]}" alt="${type}" />`
const boatLogoFor = (number) => boatLogo(boatType(number))
const boatLabel = (number) =>
  number === null || number === undefined
    ? "Senza barca"
    : `${boatType(number)} ${number}`
const faults = [
  {
    boat: 3,
    text: "Strozzascotte sinistro: la cima scivola quando aumenta il carico. Controllare le ganasce prima dell'uscita.",
    state: 0,
  },
  {
    boat: 7,
    text: "Scotta randa con anima scoperta vicino al bozzello. Segnalata al responsabile dei mezzi.",
    state: 1,
  },
  {
    boat: 11,
    text: "Rollafiocco duro nell'ultimo giro; verificare la tensione e il passaggio della cima.",
    state: 0,
  },
]
const initialNotes = {
  0: "Ha già frequentato D1. Buona autonomia nelle manovre.",
  4: "Prima esperienza in deriva; partire dalle regolazioni di base.",
}
function isoWeekParts(date) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const isoYear = day.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  return {
    week: Math.ceil(((day - yearStart) / 86400000 + 1) / 7),
    year: isoYear,
  }
}
const mockCalendarCourse = isoWeekParts(new Date(Date.UTC(2026, 7, 29)))
let noteContext = "initial"
let currentProfile = 0
let courseFamily = "Deriva",
  courseLevel = 2
const courseWeek = mockCalendarCourse.week,
  courseYear = mockCalendarCourse.year
let count = 21,
  mode = "normal",
  page = pages.some((p) => p[0] === location.hash.slice(1))
    ? location.hash.slice(1)
    : "P01"
let selected = null,
  assignments = [],
  crewBoats = [],
  sessionBoats = new Set(boatNumbers),
  terra = [16, 17],
  more = new Set(),
  staying = new Set(),
  dutyRemovals = new Set(),
  dutyAdds = new Set(),
  midweek = false
let evaluation = {},
  notes = {},
  sizes = {},
  profileEditing = false,
  scanStep = 0,
  unavailable = new Set(),
  selectedDay = 0
let pendingCrew = null,
  selectedCrewForBoat = null,
  lastCrewTapId = null,
  lastCrewTapAt = 0,
  toastTimer,
  lastFocus
let scanCandidates = [
  { id: 0, name: "Giulia Moretti", birth: "2000-04-12" },
  { id: 1, name: "Luca Bianchi", birth: "" },
  { id: 2, name: "Anna Riva", birth: "2000-04-12" },
]
const $ = (s) => document.querySelector(s)
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  )
const act = (label, action, arg = "", cls = "", extra = "") =>
  `<button type="button" class="${cls}" data-action="${action}" data-arg="${esc(arg)}" ${extra}>${label}</button>`
const all = () => people.slice(0, count)
const person = (id) =>
  people.find((p) => p.id === id) || staff.find((p) => p.id === id)
const isWarning = () => mode === "warnings"
const courseLabel = () =>
  `${courseFamily === "Cabinato" ? "C" : "D"}${courseLevel} - ${courseWeek} | ${courseYear}`
const name = (id) => {
  const p = person(id)
  return isWarning() && id === 19 ? "Alessandro Della Valle" : p.name
}
const fullName = (id) => {
  const p = person(id)
  return `${p.name} ${p.surname || ""}`.trim()
}
const displaySize = (id) =>
  isWarning() && (id === 0 || id === 1) ? "XL" : sizes[id] || person(id).size
const minor = (id) =>
  person(id).age < 18
    ? '<span class="badge minor" aria-label="Minorenne">M</span>'
    : ""
const warn = (major = false) =>
  `<span class="warning ${major ? "major" : ""}" aria-label="${major ? "Avviso rosso" : "Avviso giallo"}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 22 21H2L12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5M12 17.5v.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>`
function initCrews() {
  assignments = Array.from({ length: Math.ceil((count - 2) / 2) }, (_, i) => [
    i * 2 < 16 ? i * 2 : null,
    i * 2 + 1 < 16 ? i * 2 + 1 : null,
  ])
  crewBoats = assignments.map((_, i) =>
    i === 4 ? null : i === 5 ? "Mezzi" : (boatNumbers[i] ?? null),
  )
  selected = null
  selectedCrewForBoat = null
  sessionBoats = new Set(boatNumbers.filter((number) => number !== 11))
}
initCrews()
function personButton(id, action = "profile", arg = id, crew = false) {
  const p = person(id)
  return act(
    `<span class="person-name">${esc(name(id))} ${minor(id)}</span><span class="person-meta">${p.role ? `<span class="badge staff">${p.role}</span>` : crew ? `${displaySize(id)}${id === 0 ? ' · <span class="badge" aria-label="Comandata corrente">C</span>' : ""}` : `${p.age} anni · ${p.sex}`}</span>`,
    action,
    arg,
    `${crew ? "crew-member" : "person"}${selected === id ? " selected" : ""}${isWarning() && id === 22 ? " disabled-person" : ""}`,
    `aria-pressed="${selected === id}"${crew && id < 100 ? ` data-double-action="crewReturn" aria-label="${esc(name(id))}. Doppio tap per rendere disponibile"` : ""}`,
  )
}
function toast(message) {
  clearTimeout(toastTimer)
  $("#toast").textContent = message
  $("#toast").hidden = false
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 2400)
}
function showSheet(title, body) {
  lastFocus = document.activeElement
  const el = $("#sheet")
  el.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="row"><h3 id="sheet-title">${esc(title)}</h3>${act("×", "close", "", "close", 'aria-label="Chiudi"')}</div><div class="sheet-body">${body}</div></section>`
  el.hidden = false
  el.querySelector("button,input,textarea,select")?.focus()
}
function closeSheet() {
  $("#sheet").hidden = true
  $("#sheet").innerHTML = ""
  if (lastFocus?.isConnected) lastFocus.focus()
}
function setPage(id) {
  closeSheet()
  page = id
  $("#page-picker").value = id
  history.replaceState(null, "", `#${id}`)
  render()
  $("#app-content").scrollTop = 0
}
const field = (label, value, key, type = "text") =>
  `<label class="field">${label}<input type="${type}" value="${esc(value)}" data-field="${key}" /></label>`
const sizeChoice = (id) =>
  `<div class="segments" role="group" aria-label="Taglia di ${esc(name(id))}">${["XS", "S", "M", "L", "XL"].map((s) => act(s, "size", `${id}:${s}`, "", `aria-pressed="${(sizes[id] || person(id).size) === s}"`)).join("")}</div>`
function empty(title, button, target) {
  return `<div class="empty"><h3>${title}</h3><p class="muted">Puoi iniziare da qui.</p>${act(button, "goto", target, "primary full")}</div>`
}
function capacities() {
  const start = midweek ? 2 : 0
  const n = count - (midweek ? (count === 23 ? 8 : 6) : 0)
  const d = 7 - start
  const base = Math.floor(n / d)
  const rem = n % d
  const result = Array(7).fill(null)
  for (let i = start; i < 7; i++) result[i] = base
  ;[...more]
    .filter((i) => i >= start)
    .slice(0, rem)
    .forEach((i) => result[i]++)
  return result
}
function duties() {
  const result = []
  let offset = 0
  for (let i = 0; i < 7; i++) {
    const n = Math.floor(count / 7) + (i < count % 7 ? 1 : 0)
    result.push(
      all()
        .slice(offset, offset + n)
        .map((p) => p.id),
    )
    offset += n
  }
  if (isWarning()) result[4][0] = result[0][0]
  for (const key of dutyRemovals) {
    const [day, id] = key.split(":").map(Number)
    result[day] = result[day].filter((personId) => personId !== id)
  }
  for (const key of dutyAdds) {
    const [day, id] = key.split(":").map(Number)
    if (!result[day].includes(id)) result[day].push(id)
  }
  return result
}
function boatsMarkup(action = "boatDetail") {
  return `<div class="grid-two boat-list-r2">${boatNumbers
    .map((n) => {
      const red = unavailable.has(n) || (isWarning() && n === 11)
      const openFaults = faults.filter((f) => f.boat === n && f.state !== 2)
      const stateClass = red
        ? "not-available"
        : openFaults.length
          ? "needs-check"
          : "ready"
      return act(
        `<span class="boat-identity">${boatLogoFor(n)}<strong>${n}</strong></span><div class="row"><span class="boat-fault-count">${openFaults.length} ${openFaults.length === 1 ? "avaria" : "avarie"}</span><span class="boat-state ${stateClass}">${red ? "Non disponibile" : openFaults.length ? "Da controllare" : "Disponibile"}</span></div>`,
        action,
        n,
        `boat-card boat-card-r2${red ? " unavailable" : ""}${action === "boatToggle" && sessionBoats.has(n) ? " selected" : ""}`,
        action === "boatToggle" ? `aria-pressed="${sessionBoats.has(n)}"` : "",
      )
    })
    .join("")}</div>`
}
function rosterMarkup() {
  let ordered = all()
    .slice()
    .sort(
      (a, b) =>
        a.surname.localeCompare(b.surname, "it") ||
        a.name.localeCompare(b.name, "it"),
    )
  return `<div class="grid-two">${ordered.map((p) => personButton(p.id)).join("")}</div>`
}
function profileMarkup() {
  const p = person(currentProfile)
  const dob = currentProfile === 0 ? "2009-03-18" : `${2026 - p.age}-03-18`
  const sexButtons = `<div class="segments sex-buttons" role="group" aria-label="Sesso">${[
    "F",
    "M",
    "Altro",
  ]
    .map((sex) => act(sex, "sex", sex, "", `aria-pressed="${p.sex === sex}"`))
    .join("")}</div>`
  const otherNotes =
    currentProfile === 0
      ? `<div class="profile-block other-notes"><div class="row"><h3>Note recenti</h3><span class="small muted">solo se presenti</span></div><article class="profile-note secondary-note"><small>Domenica PM · valutazione</small><span>Più sicura nella virata; ricordare lo sguardo fuori dalla barca.</span></article><article class="profile-note secondary-note"><small>Lunedì AM · corso</small><span>Lavora bene in coppia; riprendere la regolazione del fiocco.</span></article>${act("Altre note", "profileNotes", currentProfile, "plain full compact")}</div>`
      : ""
  if (profileEditing)
    return `<div class="notice">Modifiche salvate automaticamente quando i dati sono validi.</div><div class="form-grid">${field("Nome", p.name.split(" ")[0], "firstName")}${field("Cognome", p.surname, "surname")}${field("Nome visualizzato", p.name, "nickname")}${field("Data di nascita", dob, "dob", "date")}</div><h3>Sesso</h3>${sexButtons}${field("Telefono", "", "phone", "tel")}<h3>Taglia</h3>${sizeChoice(currentProfile)}<div class="profile-block"><div class="row"><h3>Nota iniziale</h3><span class="small muted">testo o voce</span></div>${act(initialNotes[currentProfile] || "Aggiungi nota", "note", currentProfile, "profile-note")}</div>${otherNotes}<p class="small muted" id="save-state">Salvato</p>${act("Fine", "editProfile", "off", "primary full")}`
  return `<div class="profile-hero"><div><h3>${esc(p.name)} ${esc(p.surname)} ${minor(currentProfile)}</h3><p class="muted">${p.age} anni · ${p.sex}</p></div>${act("Modifica", "editProfile", "on", "compact")}</div><div class="profile-facts"><div class="profile-fact"><small>Data di nascita</small><strong>${dob.split("-").reverse().join("/")}</strong></div><div class="profile-fact"><small>Telefono</small><strong>—</strong></div></div><div class="profile-block"><div class="row"><h3>Sesso</h3><span class="small muted">salvataggio immediato</span></div>${sexButtons}</div><div class="profile-block"><h3>Taglia</h3>${sizeChoice(currentProfile)}</div><div class="profile-block"><div class="row"><h3>Nota iniziale</h3><span class="small muted">testo o voce</span></div>${act(initialNotes[currentProfile] || "Aggiungi nota", "note", currentProfile, "profile-note")}</div>${otherNotes}<div class="profile-block">${act(`<span class="profile-evals-head"><span><strong>Valutazioni</strong><small class="muted">6 voti · ultima valutazione +</small></span><span>Apri</span></span>${weekGridMarkup(`Riepilogo settimanale di ${name(currentProfile)}`, "profile-week-grid")}`, "historyProfile", currentProfile, "profile-evals")}</div><div style="margin-top:10px">${act("Disponibilità ed eliminazione", "profileMore", "", "plain full")}</div>`
}
function scanMarkup() {
  if (scanStep >= 2) {
    const missing = scanCandidates.reduce(
      (total, candidate) =>
        total + Number(!candidate.name.trim()) + Number(!candidate.birth),
      0,
    )
    const inserted = scanCandidates.filter(
      (candidate) => candidate.name.trim() && candidate.birth,
    ).length
    return `<div class="scan-progress" id="scan-progress"><span><strong data-scan-stat="rows">${scanCandidates.length}</strong>righe da controllare</span><span class="${missing ? "needs-work" : "complete"}"><strong data-scan-stat="missing">${missing}</strong>campi da completare</span><span><strong data-scan-stat="inserted">${inserted}</strong>allievi inseriti</span></div><div class="stack scan-review">${scanCandidates
      .map(
        (candidate) =>
          `<section class="panel scan-candidate" data-candidate="${candidate.id}"><div class="row"><strong>${esc(candidate.name || "Riga senza nome")}</strong>${act("×", "removeCandidate", candidate.id, "", 'aria-label="Rimuovi riga"')}</div><label class="field">Nome<input value="${esc(candidate.name)}" data-scan-field="name" data-scan-id="${candidate.id}" /></label><label class="field">Data di nascita<input type="date" value="${esc(candidate.birth)}" data-scan-field="birth" data-scan-id="${candidate.id}" /></label>${!candidate.birth || !candidate.name.trim() ? '<span class="warning">Completa i campi obbligatori</span>' : ""}</section>`,
      )
      .join(
        "",
      )}</div><div style="margin-top:12px">${act("Conferma righe complete", "scanConfirm", "", "primary full")}</div>`
  }
  if (scanStep === 1)
    return `<div class="camera-frame"><div class="camera-label">Foto ritagliata · nome, cognome, nascita</div><div class="camera-sheet"><div class="table-row"><strong>Nome</strong><strong>Cognome</strong><strong>Nascita</strong></div><div class="table-row"><span>Giulia</span><span>Moretti</span><span>18/03/2009</span></div><div class="table-row"><span>Luca</span><span>Bianchi</span><span>07/06/2002</span></div></div></div><div class="scan-actions">${act("Regola di nuovo", "cameraOpen", "", "full")}${act("Leggi gli allievi", "scanNext", "", "primary full")}</div>`
  return `<div class="scan-start"><div class="scan-glyph" aria-hidden="true">▣</div><h3>Importa il foglio allievi</h3><p class="muted">Fotografa il foglio intero. Dopo lo scatto puoi raddrizzarlo e ritagliare solo nome, cognome e nascita.</p><div class="scan-actions">${act("Fai una foto", "cameraOpen", "", "primary full")}${act("Scegli dalla galleria", "scanFile", "", "full")}</div></div>`
}
function dutyMarkup() {
  const groups = duties()
  const assigned = new Set(groups.flat()).size
  const complete = assigned === count
  return `<div class="duty-sticky"><div class="toolbar">${act("Nuova proposta", "goto", "P12")}${act("Avvisi" + (isWarning() ? " · 2" : ""), "dutyWarnings", "", isWarning() ? "danger" : "")}</div><div class="duty-coverage ${complete ? "complete" : "incomplete"}"><strong>${assigned}/${count}</strong><span>allievi nelle Comandate</span></div></div>${isWarning() ? '<div class="notice error"><strong>Controlla le assegnazioni.</strong><br />Giulia compare sabato e mercoledì; una persona è senza giorno.</div>' : ""}<div class="duty-grid">${groups
    .map((ids, i) =>
      act(
        `<span class="duty-title"><strong>${days[i]}</strong><span>${ids.length}${isWarning() && (i === 0 || i === 4) ? " " + warn(true) : ""}</span></span><span class="duty-divider"></span>${ids.map((id) => `<span class="duty-person">${esc(name(id))} ${minor(id)} ${isWarning() && id === 0 ? warn(true) : ""}</span>`).join("")}`,
        "dutyDay",
        i,
        `duty-card${isWarning() && (i === 0 || i === 4) ? " has-warning" : ""}`,
      ),
    )
    .join("")}</div>`
}
function proposalMarkup() {
  const caps = capacities()
  const start = midweek ? 2 : 0
  const available = count - (midweek ? (count === 23 ? 8 : 6) : 0)
  const remainingDays = 7 - start
  const base = Math.floor(available / remainingDays)
  const extra = available % remainingDays
  const chosen = [...more].filter((day) => day >= start).length
  return `<div class="panel distribution-summary"><strong>${base}</strong><span>persone per ogni giorno${extra ? `<br /><b>${extra}</b> da assegnare ai giorni scelti` : ""}</span>${act(midweek ? "Dall'inizio" : "Da metà settimana", "midweek", "", "compact")}</div><h3>Giorni con più persone</h3><div class="preview-panel"><div class="day-options more-days">${shortDays.map((day, i) => act(day, "more", i, "day-button", `aria-label="${days[i]} con più persone" aria-pressed="${more.has(i)}" ${midweek && i < 2 ? "disabled" : ""}`)).join("")}</div><div class="day-preview">${caps.map((value) => `<span>${value ?? "✓"}</span>`).join("")}</div><p class="small muted" style="text-align:center">${extra ? `Scegli ${extra} ${extra === 1 ? "giorno" : "giorni"} · ${chosen}/${extra} selezionati` : "Divisione esatta"}</p></div><h3>Preferenze</h3><label class="row panel switch-row"><span>Distribuisci i minori</span><span class="switch"><input type="checkbox" checked /><span></span></span></label><label class="row panel switch-row" style="margin-top:7px"><span>Bilancia il sesso</span><span class="switch"><input type="checkbox" checked /><span></span></span></label><h3>Restano la prossima settimana</h3>${act(`Scegli tra tutti gli allievi <span class="muted">· ${staying.size}</span>`, "stayPicker", "", "full")}${staying.size ? `<div class="stay-summary">${[...staying].map((id) => `<span class="person-chip">${esc(name(id))}</span>`).join("")}</div>` : '<p class="small muted">Nessun allievo selezionato.</p>'}<p class="muted small">Saranno preferiti per venerdì, fino ai posti necessari.</p>${act(extra === chosen ? "Genera proposta" : `Scegli ancora ${extra - chosen}`, "proposalConfirm", "", "primary full", extra === chosen ? "" : "disabled")}`
}
function dutyPeopleMarkup() {
  const groups = duties()
  const uses = new Map()
  groups.forEach((ids, day) =>
    ids.forEach((id) => uses.set(id, [...(uses.get(id) || []), day])),
  )
  const removeDay = (p, day) =>
    `<span class="duty-day-assignment"><span class="duty-day-label" title="${days[day]}">${dutyDayShort[day]}</span>${act("×", "dutyRemove", `${day}:${p.id}`, "remove-duty", `aria-label="Rimuovi ${esc(name(p.id))} da ${days[day]}"`)}</span>`
  const addGlyph =
    '<span class="duty-add-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>'
  const current = all().filter((p) =>
    (uses.get(p.id) || []).includes(selectedDay),
  )
  const never = all().filter((p) => !(uses.get(p.id) || []).length)
  const elsewhere = all().filter((p) => {
    const assignedDays = uses.get(p.id) || []
    return assignedDays.length && !assignedDays.includes(selectedDay)
  })
  const currentRow = (p) => {
    const otherDays = (uses.get(p.id) || []).filter(
      (day) => day !== selectedDay,
    )
    return `<div class="panel duty-person-row${otherDays.length ? " duty-person-wide" : ""}"><span class="duty-person-main"><strong title="${esc(fullName(p.id))}">${esc(name(p.id))} ${minor(p.id)}</strong>${otherDays.length ? `<small class="duplicate-note">${warn(true)} ${[selectedDay, ...otherDays].map((day) => dutyDayShort[day]).join(", ")}</small>` : ""}</span><span class="duty-day-assignments">${removeDay(p, selectedDay)}${otherDays.map((day) => removeDay(p, day)).join("")}</span></div>`
  }
  const neverRow = (p) =>
    `<div class="panel duty-person-row">${act(`<strong title="${esc(fullName(p.id))}">${esc(name(p.id))} ${minor(p.id)}</strong>${addGlyph}`, "dutyAddCurrent", p.id, "duty-person-main duty-person-action", `aria-label="Assegna ${esc(name(p.id))} a ${days[selectedDay]}"`)}</div>`
  const elsewhereRow = (p) => {
    const assignedDays = uses.get(p.id) || []
    return `<div class="panel duty-person-row${assignedDays.length > 1 ? " duty-person-wide" : ""}">${act(`<strong title="${esc(fullName(p.id))}">${esc(name(p.id))} ${minor(p.id)}</strong>${addGlyph}`, "dutyAddCurrent", p.id, "duty-person-main duty-person-action", `aria-label="Assegna ${esc(name(p.id))} anche a ${days[selectedDay]}"`)}<span class="duty-day-assignments">${assignedDays.map((day) => removeDay(p, day)).join("")}</span></div>`
  }
  return `<h3>In ${days[selectedDay]} · ${current.length}</h3><div class="stack duty-people-list">${current.map(currentRow).join("") || '<p class="muted">Nessuna persona assegnata.</p>'}</div><h3>Mai assegnati · ${never.length}</h3><div class="stack duty-people-list">${never.map(neverRow).join("") || '<p class="muted">Tutti hanno almeno un giorno.</p>'}</div><h3>Assegnati ad altri giorni · ${elsewhere.length}</h3><div class="stack duty-people-list">${elsewhere.map(elsewhereRow).join("") || '<p class="muted">Nessuna assegnazione in altri giorni.</p>'}</div>`
}
function crewMarkup() {
  const assigned = assignments.flat().filter((id) => id !== null)
  const pool = all().filter(
    (p) => !assigned.includes(p.id) && !terra.includes(p.id),
  )
  return `<div class="toolbar crew-toolbar">${act("Barche", "goto", "P15")}${act("Vista lettura", "goto", "P16")}${act("⋯", "crewMore", "", "more-button", 'aria-label="Altre azioni"')}</div><div class="crew-pool"><div class="row"><h3 style="margin:0">Disponibili · ${pool.length}</h3>${selected !== null ? act("Annulla", "cancelSelect", "", "compact") : ""}</div><div class="grid-two">${pool.map((p) => personButton(p.id, "selectPerson", p.id)).join("")}</div>${!pool.length ? '<p class="small muted">Tutti gli allievi sono collocati.</p>' : ""}</div><div class="crew-grid">${assignments
    .map((ids, i) => {
      const boat = crewBoats[i]
      const red = unavailable.has(boat) || (boat === 11 && isWarning())
      const yellow = faults.some(
        (fault) => fault.boat === boat && fault.state !== 2,
      )
      const crewSizeWarning = isWarning() && i === 0
      const boatIdentity = boat
        ? boat === "Mezzi"
          ? '<span class="boat-summary-id text-only">Mezzi</span>'
          : `<span class="boat-summary-id" title="${boatLabel(boat)}">${boatLogoFor(boat)}<strong>${boat}</strong></span>`
        : '<span class="boat-summary-id text-only muted">Senza barca</span>'
      return `<section class="crew-card"><div class="crew-head">${act(`<span>${boatIdentity}</span><span class="muted small">Equipaggio ${i + 1}</span>`, "crewDestination", i, "crew-destination", `aria-label="Destinazione equipaggio ${i + 1}"`)}${red || yellow || crewSizeWarning ? act(warn(red || crewSizeWarning), "crewWarning", i, "crew-warning", `aria-label="Motivo avviso equipaggio ${i + 1}"`) : '<span aria-hidden="true"></span>'}</div><div class="crew-members">${ids.map((id, j) => (id === null ? act("Posto libero +", "slot", `${i}:${j}`, "crew-member", `aria-label="Posto libero equipaggio ${i + 1}"`) : personButton(id, "selectPerson", id, true))).join("")}</div></section>`
    })
    .join("")}</div>`
}
function sessionBoatMeta(n) {
  const assignedCrew = crewBoats.findIndex((boat) => boat === n)
  const unavailableBoat =
    !sessionBoats.has(n) || unavailable.has(n) || (isWarning() && n === 11)
  return {
    assignedCrew,
    state: unavailableBoat
      ? "boat-unavailable"
      : assignedCrew >= 0
        ? "boat-assigned"
        : "boat-available",
    label: unavailableBoat
      ? "Non disponibile"
      : assignedCrew >= 0
        ? `Assegnata all'equipaggio ${assignedCrew + 1}`
        : "Disponibile non assegnata",
    shortLabel: unavailableBoat
      ? "Non disponibile"
      : assignedCrew >= 0
        ? `Equipaggio ${assignedCrew + 1}`
        : "Disponibile",
  }
}
function boatsSessionMarkup() {
  const boatDestination = (boat) =>
    boat
      ? boat === "Mezzi"
        ? '<span class="boat-summary-id text-only">Mezzi</span>'
        : `<span class="boat-summary-id" title="${boatLabel(boat)}">${boatLogoFor(boat)}<strong>${boat}</strong></span>`
      : '<span class="boat-summary-id text-only muted">Senza barca</span>'
  const boatControl = (n) => {
    const { state, label } = sessionBoatMeta(n)
    return act(
      `${boatLogoFor(n)}<strong>${n}</strong>`,
      "boatToggle",
      n,
      `boat-toggle-r2 ${state}`,
      `aria-label="${boatLabel(n)} · ${label}" aria-pressed="${sessionBoats.has(n)}"`,
    )
  }
  return `<div class="boat-strip-wrap"><div class="row"><p class="small muted">Barche nell'uscita</p><span class="small">Includi / escludi</span></div><div class="boat-state-legend"><span class="legend-assigned">Assegnata</span><span class="legend-available">Libera</span><span class="legend-unavailable">Non disponibile</span></div><div class="boat-strip">${boatNumbers.map(boatControl).join("")}</div></div><h3>Equipaggi</h3><p class="small muted boat-assignment-help">Per assegnare: equipaggio, poi barca blu.</p>${selectedCrewForBoat !== null ? `<div class="notice boat-pending">Equipaggio ${selectedCrewForBoat + 1} selezionato · scegli una barca blu.</div>` : ""}<div class="stack compact-crew-list">${assignments
    .slice(0, 8)
    .map((ids, i) =>
      act(
        `<span class="row"><strong>Equipaggio ${i + 1}</strong><span class="boat-summary-wrap">${boatDestination(crewBoats[i])}${isWarning() && crewBoats[i] === 11 ? warn(true) : ""}</span></span><span class="crew-summary-names muted">${ids
          .filter((id) => id !== null)
          .map((id) => esc(name(id)))
          .join(" / ")}</span>`,
        "selectCrewForBoat",
        i,
        "panel crew-session-summary",
        `aria-label="Equipaggio ${i + 1}, ${crewBoats[i] ? (crewBoats[i] === "Mezzi" ? "Mezzi" : boatLabel(crewBoats[i])) : "senza barca"}" aria-pressed="${selectedCrewForBoat === i}"`,
      ),
    )
    .join(
      "",
    )}</div>${act("Torna agli equipaggi", "goto", "P14", "primary full")}`
}
function evaluationMarkup() {
  return `<div class="toolbar">${act("Allievi", "evalView", "all", "selected")}${act("Equipaggi", "evalView", "crew")}${act("Riepilogo", "goto", "P18")}</div><div id="evaluation-list">${evaluationRows(all().map((p) => p.id))}</div>`
}
function evaluationRows(ids) {
  return ids
    .map(
      (id) =>
        `<div class="evalrow">${act(`<span title="${esc(fullName(id))}">${esc(fullName(id))}${terra.includes(id) ? '<small class="muted"> · terra</small>' : ""}</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20zM13.5 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`, "note", id, "eval-name", `aria-label="Nota di ${esc(fullName(id))}"`)}<div class="eval-marks">${marks.map((mark) => act(markIcon(mark), "mark", `${id}:${mark}`, `mark ${mark.includes("+") ? "pos" : mark === "-" || mark === "--" ? "neg" : ""}`, `aria-label="${esc(fullName(id))}: ${mark}" aria-pressed="${evaluation[id] === mark}"`)).join("")}</div></div>`,
    )
    .join("")
}
function overviewMarkup() {
  return `<small class="overview-sort-label">Ordinamento</small><div class="toolbar overview-sort-buttons">${act("Alfabetico", "sortOverview", "alpha", "selected")}${act("Valutazione", "sortOverview", "score")}</div><div class="stack" id="overview-list">${overviewRows(all())}</div>`
}
const sampleWeekValues = [
  "=",
  "+",
  "+",
  "++",
  null,
  "+",
  "=",
  null,
  null,
  null,
  null,
  null,
  null,
]
const sampleWeekPairs = [
  [null, 0],
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
]
const markClass = (value) =>
  value?.includes("+") ? "pos" : value?.includes("-") ? "neg" : "neutral"
function weekSummaryCell(index) {
  if (index === null)
    return '<span class="eval-cell empty-eval" aria-label="Nessuna sessione"></span>'
  const value = sampleWeekValues[index]
  if (value === null)
    return `<span class="eval-cell empty-eval" aria-label="${sessions[index]}: nessuna valutazione"></span>`
  return `<span class="eval-cell ${markClass(value)}" aria-label="${sessions[index]}: ${value}">${value}</span>`
}
function weekGridMarkup(label, className = "") {
  return `<span class="week-grid ${className}" aria-label="${esc(label)}">${sampleWeekPairs.map((pair, day) => `<span class="week-day"><small>${shortDays[day]}</small>${weekSummaryCell(pair[0])}${weekSummaryCell(pair[1])}</span>`).join("")}</span>`
}
function overviewRows(list) {
  return list
    .map(
      (p) =>
        `<section class="panel overview-card"><div class="overview-head">${act(esc(name(p.id)), "historyProfile", p.id, "plain compact")}<span class="small muted">6 voti</span></div>${weekGridMarkup(`Settimana di ${name(p.id)}`)}</section>`,
    )
    .join("")
}
function historyMarkup() {
  const summary = `<section class="panel history-summary"><div class="row"><strong>Riepilogo settimana</strong><span class="small muted">AM / PM</span></div>${weekGridMarkup("Riepilogo settimanale")}</section>`
  return `<div class="history-subject"><h3>${esc(fullName(currentProfile))}</h3><span>Storia del corso</span></div>${summary}<div class="stack history-days">${sampleWeekPairs
    .map(
      (pair, day) =>
        `<section class="panel history-day"><div class="row"><strong>${days[day]}</strong><span class="small muted">${pair.filter((i) => i !== null).length} ${pair[0] === null ? "sessione" : "sessioni"}</span></div><div class="session-cards">${pair.map((index, slot) => (index === null ? '<div class="session-card compact-empty muted"><strong>AM</strong><span>Nessuna sessione</span></div>' : `<div class="session-card ${index === 2 ? "has-note" : "compact-empty"}"><strong>${slot === 0 ? "AM" : "PM"}<span class="history-mark ${sampleWeekValues[index] === null ? "" : markClass(sampleWeekValues[index])}" aria-label="${sampleWeekValues[index] === null ? "Nessuna valutazione" : "Valutazione " + sampleWeekValues[index]}">${sampleWeekValues[index] || ""}</span></strong><span>${index === 2 ? "Più sicura nella virata; ricordare lo sguardo." : "Nessuna nota."}</span></div>`)).join("")}</div></section>`,
    )
    .join("")}</div>`
}

function markIcon(mark) {
  const stroke =
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'
  const plus = (x) => `<path d="M${x} 7v10M${x - 5} 12h10" ${stroke}/>`
  const minus = (x) => `<path d="M${x - 5} 12h10" ${stroke}/>`
  const paths =
    mark === "++"
      ? plus(7) + plus(17)
      : mark === "+"
        ? plus(12)
        : mark === "="
          ? '<path d="M6 9h12M6 15h12" ' + stroke + "/>"
          : mark === "--"
            ? '<path d="M2 12h9M13 12h9" ' + stroke + "/>"
            : minus(12)
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths}</svg>`
}

function homeIcon(kind) {
  const paths = {
    Allievi:
      '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 11a3 3 0 1 0 0-6M16.5 14c2.5.2 3.8 2.2 4 5"/>',
    Barche: '<path d="M3 17h18l-3 3H7l-4-3ZM11 4v13M12 5l6 9h-6M10 7l-5 7h5"/>',
    Comandate:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/>',
    Equipaggi:
      '<circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 19c.3-3.5 1.8-5.2 4.5-5.2s4.2 1.7 4.5 5.2M12.5 19c.3-3.5 1.8-5.2 4.5-5.2s4.2 1.7 4.5 5.2"/>',
    Valutazioni:
      '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    Volontari:
      '<circle cx="12" cy="8" r="3"/><path d="M5.5 20c.4-4.2 2.6-6.2 6.5-6.2s6.1 2 6.5 6.2M18 5l1 1 2-2"/>',
  }
  return `<svg class="home-mark" aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</g></svg>`
}

function openCamera(adjust = false) {
  lastFocus = document.activeElement
  const sheet = $("#sheet")
  sheet.innerHTML = `<section class="camera-full ${adjust ? "camera-adjust" : ""}" role="dialog" aria-modal="true" aria-label="${adjust ? "Regola foto" : "Fotocamera"}"><div class="row">${act("×", "close", "", "", 'aria-label="Chiudi fotocamera"')}<strong>${adjust ? "Raddrizza e ritaglia" : "Foglio allievi"}</strong><span style="width:44px"></span></div><div class="camera-live"><div class="camera-paper"><strong>Nome&nbsp;&nbsp; Cognome&nbsp;&nbsp; Nascita</strong><hr />Giulia&nbsp;&nbsp; Moretti&nbsp;&nbsp; 18/03/2009<br />Luca&nbsp;&nbsp; Bianchi&nbsp;&nbsp; 07/06/2002</div><div class="camera-guide-r2"></div></div>${adjust ? `<label class="field" style="color:white">Rotazione libera<input type="range" min="-180" max="180" value="-7" aria-label="Rotazione da meno 180 a 180 gradi" /></label><p class="small" style="text-align:center">Trascina il riquadro per ritagliare nome, cognome e nascita.</p>${act("Usa questa area", "cameraDone", "", "primary full")}` : act("", "cameraCapture", "", "camera-shutter", 'aria-label="Scatta foto"')}</section>`
  sheet.hidden = false
}
function openStayPicker() {
  showSheet(
    `Restano la prossima settimana · ${staying.size}`,
    `<div class="grid-two stay-picker">${all()
      .map((p) =>
        act(
          esc(name(p.id)),
          "stay",
          p.id,
          "",
          `aria-pressed="${staying.has(p.id)}"`,
        ),
      )
      .join(
        "",
      )}</div><p class="small muted">Tutti gli allievi del corso sono disponibili.</p>`,
  )
}

function content() {
  if (
    mode === "empty" &&
    [
      "P03",
      "P05",
      "P08",
      "P09",
      "P10",
      "P11",
      "P14",
      "P17",
      "P18",
      "P19",
    ].includes(page)
  ) {
    const map = {
      P08: ["Nessuna barca", "Configura barche", "P07"],
      P09: ["Nessuna avaria", "Aggiungi avaria", "P09"],
      P10: ["Nessun volontario", "Aggiungi volontario", "P10"],
    }
    const e = map[page] || ["Nessun allievo", "Aggiungi allievo", "P04"]
    return empty(...e)
  }
  switch (page) {
    case "P01":
      return `<div class="home-course"><div class="course-line"><strong>${courseLabel().split(" | ")[0]}</strong><span class="year">| ${courseYear}</span></div></div><div class="grid-two">${[
        ["Allievi", "P03"],
        ["Barche", "P08"],
        ["Comandate", "P11"],
        ["Equipaggi", "P14"],
        ["Valutazioni", "P17"],
        ["Volontari", "P10"],
      ]
        .map(([label, id]) =>
          act(
            `${homeIcon(label)}<span>${label}</span>`,
            "goto",
            id,
            "home-card",
          ),
        )
        .join("")}</div>`
    case "P02":
      return `<h3>Famiglia</h3><div class="segments">${act("Deriva", "courseFamily", "Deriva", "", `aria-pressed="${courseFamily === "Deriva"}"`)}${act("Cabinato", "courseFamily", "Cabinato", "", `aria-pressed="${courseFamily === "Cabinato"}"`)}</div><h3>Livello</h3><div class="segments">${[1, 2, 3, 4, 5].map((n) => act(n, "courseLevel", n, "", `aria-pressed="${courseLevel === n}"`)).join("")}</div><h3>Il tuo corso</h3><div class="panel course-generated" aria-live="polite"><strong>${courseLabel().split(" | ")[0]} <span>| ${courseYear}</span></strong><p class="muted">Settimana ISO ${courseWeek} e anno derivati automaticamente dal calendario.</p></div><div style="margin-top:18px">${act("Crea corso", "goto", "P01", "primary full")}</div>`
    case "P03":
      return (
        rosterMarkup() +
        act("+", "newStudent", "", "fab", 'aria-label="Aggiungi allievo"')
      )
    case "P04":
      return profileMarkup()
    case "P05":
      return `<div class="stack">${all()
        .map(
          (p) =>
            `<section class="panel knowledge-row">${act(`<span class="knowledge-name">${esc(name(p.id))} ${minor(p.id)}</span><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`, "note", p.id, "knowledge-person", `aria-label="Nota di ${esc(name(p.id))}"`)}${sizeChoice(p.id)}${initialNotes[p.id] ? `<p class="knowledge-preview">${esc(initialNotes[p.id])}</p>` : ""}</section>`,
        )
        .join("")}</div>`
    case "P06":
      return scanMarkup()
    case "P07":
      return `<div class="notice"><strong>Prima configurazione.</strong><br />Questo inserimento multiplo compare quando il corso non ha ancora barche.</div><label class="field">Tipo di barca<select id="boat-type">${boatTypes.map((type) => `<option>${type}</option>`).join("")}</select></label><label class="field">Numeri delle barche<textarea id="boat-input" placeholder="2 3 7, 8; 11">2 3 7, 8; 11</textarea></label><p class="small muted">Separa con spazi, virgole, punti e virgola o vai a capo.</p><div class="panel" id="boat-preview">RS Quest 2 · 3 · 7 · 8 · 11</div><div style="margin-top:15px">${act("Aggiungi barche", "boatsAdd", "", "primary full")}</div>`
    case "P08":
      return boatsMarkup()
    case "P09":
      return `<div class="stack">${faults.map((fault, i) => `<section class="panel fault fault-r2 ${fault.state === 2 ? "resolved" : ""}"><div class="fault-top"><span class="boat-identity" title="${boatLabel(fault.boat)}">${boatLogoFor(fault.boat)}<strong>${fault.boat}</strong></span></div>${act(`<span class="preview">${esc(fault.text)}</span>`, "faultDetail", i, "fault-open")}<div class="segments fault-state-buttons">${["Aperta", "Comunicata", "Risolta"].map((state, j) => act(state, "faultState", `${i}:${j}`, "", `aria-pressed="${fault.state === j}"`)).join("")}</div></section>`).join("")}</div>`
    case "P10":
      return `<div class="stack">${staff.map((member) => `<section class="panel staff-card"><span class="staff-avatar">${member.name.slice(0, 1)}</span><span><strong>${member.name}</strong><small class="muted" style="display:block">${member.role === "CT" ? "Capo turno" : member.role === "IS" ? "Istruttore" : "Allievo docente volontario"}</small></span>${act(member.role, "editStaff", member.id, "role-pill")}</section>`).join("")}</div><div style="margin-top:14px">${act("Aggiungi volontario", "editStaff", "new", "primary full")}</div>`
    case "P11":
      return dutyMarkup()
    case "P12":
      return proposalMarkup()
    case "P13":
      return dutyPeopleMarkup()
    case "P14":
      return crewMarkup()
    case "P15":
      return boatsSessionMarkup()
    case "P16":
      return `<div class="stack">${assignments
        .map(
          (ids, i) =>
            `<section class="panel read-crew"><div class="read-number"><small>Eq.</small><strong>${i + 1}</strong></div><div class="read-destination">${crewBoats[i] ? (crewBoats[i] === "Mezzi" ? "<strong>Mezzi</strong>" : `${boatLogoFor(crewBoats[i])}<strong>${crewBoats[i]}</strong>`) : "<strong>—</strong><small>Senza barca</small>"}</div><div class="read-names">${
              ids
                .filter((id) => id !== null)
                .map((id) => `<span>${esc(name(id))}</span>`)
                .join("") || '<span class="muted">Posti da completare</span>'
            }</div></section>`,
        )
        .join("")}</div>`
    case "P17":
      return evaluationMarkup()
    case "P18":
      return overviewMarkup()
    case "P19":
      return historyMarkup()
    default:
      return ""
  }
}
function render() {
  const p = pages.find((p) => p[0] === page)
  $("#page-id").textContent = `${p[0]} · REVISIONE 10`
  $("#review-title").textContent = p[1]
  $("#review-goal").textContent = p[2]
  $("#review-question").textContent = p[3]
  let title =
    {
      P05: "Conoscenza",
      P12: "Proposta",
      P13: days[selectedDay],
      P15: "Barche in uscita",
      P16: "Equipaggi",
      P19: "Storia",
    }[page] || p[1]
  const hasSession = ["P14", "P15", "P16", "P17"].includes(page)
  let right = hasSession
    ? act(
        '<span>Lun</span><strong>PM</strong><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
        "session",
        "",
        "session",
        'aria-label="Sessione: lunedì pomeriggio"',
      )
    : page === "P08"
      ? act("+", "newBoat", "", "", 'aria-label="Aggiungi barca"')
      : page === "P09"
        ? act("＋", "newFault", "", "", 'aria-label="Aggiungi avaria"')
        : page === "P01"
          ? act("⚙", "settings", "", "", 'aria-label="Impostazioni"')
          : ""
  $("#app-header").innerHTML =
    `<div class="head-row">${page === "P01" ? '<span class="cvc-mark"><img src="assets/logo-fcvc.avif" alt="Centro Velico Caprera" /></span>' : `<div class="head-title">${act("‹", "back", "", "back", 'aria-label="Indietro"')}<h2>${title}</h2></div>`}${right}</div>`
  $("#app-content").innerHTML =
    (mode === "error"
      ? `<div class="notice error">Modifica non salvata. ${act("Riprova", "retry", "", "compact")}</div>`
      : "") + content()
  $("#crew-status").hidden = page !== "P14" || mode === "empty"
  $("#crew-status").innerHTML =
    `${act(`A terra · ${terra.length}`, "terra", "", "compact")}
    <span class="crew-counter">${assignments.flat().filter((id) => id !== null && id < 100).length + terra.filter((id) => id < 100).length}/${count}</span>
    ${act("Volontari", "staff", "", "compact")}`
  $("#app-nav").hidden = page === "P02"
  $("#app-nav").innerHTML = [
    ["Avarie", "P09"],
    ["Home", "P01"],
    ["Equipaggi", "P14"],
  ]
    .map(([n, id]) => act(n, "goto", id, page === id ? "active" : ""))
    .join("")
}
function locationOf(id) {
  for (let i = 0; i < assignments.length; i++) {
    const j = assignments[i].indexOf(id)
    if (j !== -1) return [i, j]
  }
  return null
}
function placeSelected(i, j) {
  if (selected === null) {
    toast("Seleziona prima una persona")
    return
  }
  const old = locationOf(selected),
    other = assignments[i][j]
  if (old) assignments[old[0]][old[1]] = other
  else if (other !== null && terra.includes(selected)) terra.push(other)
  terra = terra.filter((id) => id !== selected)
  assignments[i][j] = selected
  selected = null
  render()
  toast("Equipaggio aggiornato")
}
function handle(action, arg, button) {
  switch (action) {
    case "goto":
      if (mode === "empty" && ["P04", "P07", "P09", "P10"].includes(arg)) {
        mode = "normal"
        $("#state-picker").value = mode
      }
      setPage(arg)
      break
    case "back":
      setPage(
        ["P15", "P16"].includes(page)
          ? "P14"
          : ["P18", "P19"].includes(page)
            ? "P17"
            : "P01",
      )
      break
    case "close":
      closeSheet()
      render()
      break
    case "profile":
      currentProfile = Number(arg)
      setPage("P04")
      break
    case "historyProfile":
      currentProfile = Number(arg)
      setPage("P19")
      break
    case "profileNotes":
      showSheet(
        `Altre note · ${name(Number(arg))}`,
        '<div class="stack all-notes"><article class="panel"><small class="muted">Martedì PM · corso</small><p>Regolazioni più autonome con vento stabile.</p></article><article class="panel"><small class="muted">Domenica AM · corso</small><p>Ripassare la sequenza di partenza dal pontile.</p></article><article class="panel"><small class="muted">Sabato PM · valutazione</small><p>Buona comunicazione con il compagno di equipaggio.</p></article></div>',
      )
      break
    case "newStudent":
      profileEditing = true
      mode = "normal"
      $("#state-picker").value = mode
      setPage("P04")
      toast("Esempio del form anagrafico")
      break
    case "editProfile":
      profileEditing = arg === "on"
      render()
      break
    case "sex":
      person(currentProfile).sex = arg
      render()
      toast("Sesso aggiornato")
      break
    case "profileMore":
      showSheet(
        "Disponibilità ed eliminazione",
        `${act("Disattiva allieva", "disablePerson", "", "full")}<p class="small muted">Lo storico viene conservato.</p>${act("Elimina inserimento errato", "deletePerson", "", "danger full")}`,
      )
      break
    case "size": {
      const [id, s] = arg.split(":")
      sizes[id] = s
      render()
      toast("Taglia aggiornata")
      break
    }
    case "note":
      noteContext = page === "P17" ? "evaluation" : "initial"
      showSheet(
        "Nota · " + name(Number(arg)),
        `<label class="field">Testo<textarea id="note-draft">${esc((noteContext === "initial" ? initialNotes : notes)[arg] || "")}</textarea></label><div class="voice-inline"></div><div class="toolbar">${act("Detta", "voiceInline")}${act("Fine", "noteSave", arg, "primary")}</div>`,
      )
      break
    case "noteSave":
      ;(noteContext === "initial" ? initialNotes : notes)[arg] =
        $("#note-draft").value
      closeSheet()
      render()
      toast("Nota aggiornata")
      break
    case "voiceInline": {
      const area = button.closest(".sheet-body").querySelector(".voice-inline")
      area.innerHTML = `<div class="notice">Consenti il microfono al primo tentativo di registrazione?</div><div class="toolbar">${act("Non consentire", "voiceInlineDeny")}${act("Consenti", "voiceInlineAllow", "", "primary")}</div>`
      break
    }
    case "voiceInlineAllow":
      button.closest(".sheet-body").querySelector(".voice-inline").innerHTML =
        `<div class="voice-bars" aria-label="Registrazione in corso">${"<span></span>".repeat(11)}</div>${act("Termina registrazione", "voiceInlineStop", "", "primary full")}`
      break
    case "voiceInlineDeny":
      button.closest(".sheet-body").querySelector(".voice-inline").innerHTML =
        `<div class="notice error">Microfono non disponibile. Controlla il permesso del browser.</div>${act("Riprova", "voiceInline", "", "full")}`
      break
    case "voiceInlineStop": {
      const body = button.closest(".sheet-body")
      const textarea = body.querySelector("textarea")
      textarea.value = `${textarea.value ? textarea.value + " " : ""}Buona autonomia nelle manovre.`
      body.querySelector(".voice-inline").innerHTML =
        `<div class="notice">Trascrizione inserita. Rivedi il testo prima di chiudere.</div>`
      break
    }
    case "deletePerson":
      showSheet(
        "Eliminazione non disponibile",
        `<div class="notice error">${esc(name(currentProfile))} è già presente nei dati del corso.</div><ul><li>Comandata di sabato</li><li>Equipaggio di sabato PM</li><li>Valutazione di domenica PM</li></ul>${act("Disattiva allieva", "disablePerson", "", "full")}`,
      )
      break
    case "disablePerson":
      closeSheet()
      toast("Allieva disattivata · storia conservata")
      break
    case "choice":
      button.parentElement
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("selected"))
      button.classList.add("selected")
      break
    case "courseFamily":
      courseFamily = arg
      render()
      break
    case "courseLevel":
      courseLevel = Number(arg)
      render()
      break
    case "settings":
      showSheet(
        "Impostazioni",
        `<div class="panel"><strong>D2 · Settimana 35 · 2026</strong><p>Corso attivo</p></div><p class="muted small">Versione di riferimento 0.1.0</p>`,
      )
      break
    case "cameraOpen":
      openCamera(false)
      break
    case "cameraCapture":
      openCamera(true)
      break
    case "cameraDone":
      scanStep = 1
      closeSheet()
      render()
      toast("Foto raddrizzata e ritagliata")
      break
    case "scanNext":
      scanStep++
      render()
      break
    case "scanFile":
      scanStep = 1
      render()
      toast("Foto di esempio selezionata")
      break
    case "rotate":
      $("#camera-sheet").style.transform = "rotate(0deg)"
      toast("Orientamento corretto")
      break
    case "crop":
      scanStep = 1
      render()
      toast("Area nome, cognome e nascita selezionata")
      break
    case "removeCandidate":
      scanCandidates = scanCandidates.filter(
        (candidate) => candidate.id !== Number(arg),
      )
      render()
      break
    case "scanConfirm":
      if (
        scanCandidates.some(
          (candidate) => !candidate.name.trim() || !candidate.birth,
        )
      )
        toast("Completa o rimuovi le righe con dati obbligatori mancanti")
      else toast(`${scanCandidates.length} allievi pronti per l'inserimento`)
      break
    case "boatsAdd":
      setPage("P08")
      toast("Barche di esempio aggiunte")
      break
    case "boatDetail":
      showSheet(
        "Quest " + arg,
        `<p>${faults.find((f) => f.boat === Number(arg))?.text || "Nessuna avaria aperta"}</p>${act(unavailable.has(Number(arg)) ? "Rendi disponibile" : "Segna non disponibile", "boatAvailability", arg, "full")}`,
      )
      break
    case "boatAvailability": {
      const n = Number(arg)
      if (unavailable.has(n)) unavailable.delete(n)
      else unavailable.add(n)
      closeSheet()
      render()
      toast("Disponibilità aggiornata · assegnazioni conservate")
      break
    }
    case "faultDetail":
      showSheet("Quest " + faults[arg].boat, `<p>${esc(faults[arg].text)}</p>`)
      break
    case "faultState": {
      const [i, s] = arg.split(":")
      faults[i].state = Number(s)
      render()
      toast("Stato aggiornato")
      break
    }
    case "newBoat":
      showSheet(
        "Aggiungi una barca",
        `<label class="field">Tipo<select>${boatTypes.map((type) => `<option>${type}</option>`).join("")}</select></label>${field("Numero", "", "newBoatNumber", "number")}${act("Aggiungi", "demoSaved", "", "primary full")}`,
      )
      break
    case "newFault":
      showSheet(
        "Nuova avaria",
        `<label class="field">Barca<select><option>${boatLabel(3)}</option><option>${boatLabel(7)}</option></select></label><label class="field">Descrizione<textarea id="fault-draft"></textarea></label><div class="voice-inline"></div><div class="toolbar">${act("Detta", "voiceInline")}${act("Salva", "demoSaved", "", "primary")}</div>`,
      )
      break
    case "editStaff": {
      const creating = arg === "new"
      const member = creating ? null : person(Number(arg))
      showSheet(
        creating ? "Aggiungi volontario" : "Modifica volontario",
        `${field("Nome", member?.name || "", "staffName")}<h3>Ruolo</h3><div class="segments">${["ADV", "IS", "CT"].map((r) => act(r, "choice", "", (member?.role || "ADV") === r ? "selected" : "")).join("")}</div><div style="margin-top:15px">${act("Salva", "demoSaved", "", "primary full")}</div>`,
      )
      break
    }
    case "demoSaved":
      closeSheet()
      toast("Interazione di salvataggio mostrata")
      break
    case "dutyDay":
      selectedDay = Number(arg)
      setPage("P13")
      break
    case "dutyWarnings":
      showSheet(
        "Avvisi Comandate",
        isWarning()
          ? '<div class="notice error">Giulia assegnata sabato e mercoledì. Il rosso resta visibile anche se la scelta è intenzionale.</div><p>Una persona non ha ancora un turno.</p>'
          : "<p>Nessun avviso in questo scenario.</p>",
      )
      break
    case "midweek":
      midweek = !midweek
      more = new Set()
      render()
      break
    case "more": {
      const day = Number(arg)
      const start = midweek ? 2 : 0
      const available = count - (midweek ? (count === 23 ? 8 : 6) : 0)
      const extra = available % (7 - start)
      if (more.has(day)) more.delete(day)
      else if ([...more].filter((value) => value >= start).length < extra)
        more.add(day)
      else
        toast(
          `Sono necessari ${extra} ${extra === 1 ? "giorno" : "giorni"} con una persona in più`,
        )
      render()
      break
    }
    case "stayPicker":
      openStayPicker()
      break
    case "stay": {
      const id = Number(arg)
      if (staying.has(id)) staying.delete(id)
      else staying.add(id)
      render()
      openStayPicker()
      break
    }
    case "dutyToggle": {
      const [day, id] = arg.split(":").map(Number)
      const key = `${day}:${id}`
      const active = duties()[day].includes(id)
      if (active) {
        dutyAdds.delete(key)
        dutyRemovals.add(key)
      } else {
        dutyRemovals.delete(key)
        dutyAdds.add(key)
      }
      render()
      break
    }
    case "dutyAddCurrent": {
      const id = Number(arg)
      const key = `${selectedDay}:${id}`
      if (!duties()[selectedDay].includes(id)) {
        dutyRemovals.delete(key)
        dutyAdds.add(key)
      }
      render()
      toast(`${name(id)} assegnato a ${days[selectedDay]}`)
      break
    }
    case "dutyRemove": {
      const [day, id] = arg.split(":").map(Number)
      const key = `${day}:${id}`
      dutyAdds.delete(key)
      dutyRemovals.add(key)
      render()
      toast(`${name(id)} rimosso da ${days[day]}`)
      break
    }
    case "proposalConfirm":
      toast("Anteprima confermata in questa dimostrazione")
      break
    case "dutyAssign":
      toast(
        `${name(Number(arg))} selezionato · ripetizioni consentite con avviso`,
      )
      button.classList.toggle("selected")
      break
    case "cancelSelect":
      selected = null
      render()
      break
    case "selectPerson": {
      const id = Number(arg),
        loc = locationOf(id)
      if (selected === id) selected = null
      else if (selected !== null && loc) {
        placeSelected(...loc)
        return
      } else {
        selected = id
        if (loc && button?.dataset.doubleAction === "crewReturn") {
          button.classList.add("selected")
          button.setAttribute("aria-pressed", "true")
          break
        }
      }
      render()
      break
    }
    case "crewReturn": {
      const id = Number(arg)
      const loc = locationOf(id)
      if (id < 100 && loc) {
        assignments[loc[0]][loc[1]] = null
        selected = null
        render()
        toast(`${name(id)} di nuovo disponibile`)
      }
      break
    }
    case "slot":
      placeSelected(...arg.split(":").map(Number))
      break
    case "terra":
      if (selected !== null) {
        const loc = locationOf(selected)
        if (loc) assignments[loc[0]][loc[1]] = null
        if (!terra.includes(selected)) terra.push(selected)
        selected = null
        render()
        toast("Persona spostata A terra")
      } else
        showSheet(
          "A terra",
          `<div class="grid-two">${terra.map((id) => personButton(id, "selectTerra")).join("")}</div>`,
        )
      break
    case "selectTerra":
      selected = Number(arg)
      closeSheet()
      render()
      break
    case "staff":
      showSheet(
        "Volontari disponibili",
        `<div class="stack">${staff
          .filter((p) => !assignments.flat().includes(p.id))
          .map((p) => personButton(p.id, "selectTerra"))
          .join("")}</div>`,
      )
      break
    case "crewWarning": {
      const crewIndex = Number(arg)
      const boat = crewBoats[crewIndex]
      const reasons = faults.filter(
        (fault) => fault.boat === boat && fault.state !== 2,
      )
      const sizeReason =
        isWarning() && crewIndex === 0
          ? '<div class="notice error">Due allievi XL nello stesso equipaggio: distribuzione delle taglie da controllare.</div>'
          : ""
      showSheet(
        `Avvisi · ${boat === "Mezzi" ? "Mezzi" : boatLabel(boat)}`,
        `${sizeReason}${unavailable.has(boat) || (boat === 11 && isWarning()) ? '<div class="notice error">Barca non disponibile per il corso; assegnazione conservata.</div>' : ""}${reasons.map((fault) => `<div class="notice warn">${esc(fault.text)}</div>`).join("")}${!sizeReason && !reasons.length && !(unavailable.has(boat) || (boat === 11 && isWarning())) ? "<p>Nessun dettaglio disponibile.</p>" : ""}`,
      )
      break
    }
    case "crewDestination":
      pendingCrew = Number(arg)
      showSheet(
        `Destinazione · equipaggio ${pendingCrew + 1}`,
        `<div class="boat-state-legend destination-legend"><span class="legend-assigned">Assegnata</span><span class="legend-available">Disponibile</span><span class="legend-unavailable">Non disponibile</span></div><div class="destination-boat-grid">${[
          ...boatNumbers,
        ]
          .sort((a, b) => a - b)
          .map((n) => {
            const meta = sessionBoatMeta(n)
            return act(
              `${boatLogoFor(n)}<strong>${n}</strong><small>${meta.shortLabel}</small>`,
              "assignBoat",
              n,
              `destination-boat ${meta.state}`,
              `aria-label="${boatLabel(n)} · ${meta.label}" aria-pressed="${crewBoats[pendingCrew] === n}"`,
            )
          })
          .join(
            "",
          )}</div><div class="grid-two destination-specials">${act("Non assegnato", "assignBoat", "none")}${act("Mezzi", "assignBoat", "mezzi")}</div>`,
      )
      break
    case "assignBoat": {
      const n = arg === "none" ? null : arg === "mezzi" ? "Mezzi" : Number(arg)
      if (
        typeof n === "number" &&
        (!sessionBoats.has(n) ||
          unavailable.has(n) ||
          (isWarning() && n === 11))
      ) {
        toast("Barca non disponibile")
        return
      }
      if (
        typeof n === "number" &&
        crewBoats.some((x, i) => x === n && i !== pendingCrew)
      ) {
        toast("Barca già assegnata a un altro equipaggio")
        return
      }
      crewBoats[pendingCrew] = n
      closeSheet()
      render()
      break
    }
    case "selectCrewForBoat": {
      const crewIndex = Number(arg)
      selectedCrewForBoat = selectedCrewForBoat === crewIndex ? null : crewIndex
      render()
      if (selectedCrewForBoat !== null)
        toast(`Equipaggio ${selectedCrewForBoat + 1} selezionato`)
      break
    }
    case "boatToggle": {
      const n = Number(arg)
      const assignedCrew = crewBoats.findIndex((boat) => boat === n)
      const blocked =
        !sessionBoats.has(n) || unavailable.has(n) || (isWarning() && n === 11)
      if (selectedCrewForBoat !== null) {
        if (blocked) {
          toast("Scegli una barca blu disponibile")
          return
        }
        if (assignedCrew >= 0 && assignedCrew !== selectedCrewForBoat) {
          toast(`Barca già assegnata all'equipaggio ${assignedCrew + 1}`)
          return
        }
        crewBoats[selectedCrewForBoat] = n
        const crewNumber = selectedCrewForBoat + 1
        selectedCrewForBoat = null
        render()
        toast(`${boatLabel(n)} assegnata all'equipaggio ${crewNumber}`)
        return
      }
      if (unavailable.has(n) || (isWarning() && n === 11)) {
        toast("Barca non disponibile")
        return
      }
      const affected = crewBoats.flatMap((b, i) => (b === n ? [i + 1] : []))
      if (sessionBoats.has(n)) {
        sessionBoats.delete(n)
        crewBoats = crewBoats.map((b) => (b === n ? null : b))
      } else sessionBoats.add(n)
      render()
      toast(
        affected.length
          ? `Equipaggio ${affected.join(", ")} senza barca · persone conservate`
          : "Selezione uscita aggiornata",
      )
      break
    }
    case "crewMore":
      showSheet(
        "Equipaggi",
        `${act("Copia sessione precedente", "copyDemo", "", "full")}<p class="small muted">Copia secondaria; composizione e barche restano separate.</p>`,
      )
      break
    case "copyDemo":
      closeSheet()
      toast(
        "Esempio di copia: eventuali rimozioni si spiegano dopo l'operazione",
      )
      break
    case "mark": {
      const [id, m] = arg.split(":")
      const removing = evaluation[id] === m
      if (removing) delete evaluation[id]
      else evaluation[id] = m
      button
        .closest(".eval-marks")
        .querySelectorAll(".mark")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(!removing && b === button)),
        )
      toast(removing ? "Valutazione rimossa" : "Valutazione aggiornata")
      break
    }
    case "evalView":
      button.parentElement
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("selected"))
      button.classList.add("selected")
      $("#evaluation-list").innerHTML =
        arg === "crew"
          ? assignments
              .map(
                (ids, i) =>
                  `<h3>Equipaggio ${i + 1}</h3>${evaluationRows(ids.filter((id) => id !== null && id < 100))}`,
              )
              .join("") +
            `<h3>A terra / disponibili</h3>${evaluationRows(
              all()
                .map((p) => p.id)
                .filter((id) => !assignments.flat().includes(id)),
            )}`
          : evaluationRows(all().map((p) => p.id))
      break
    case "sortOverview":
      button.parentElement
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("selected"))
      button.classList.add("selected")
      $("#overview-list").innerHTML = overviewRows(
        all().sort((a, b) =>
          arg === "alpha"
            ? a.surname.localeCompare(b.surname, "it")
            : a.id - b.id,
        ),
      )
      break
    case "historyNote": {
      const [id, i] = arg.split(":")
      showSheet(
        `${name(Number(id))} · ${sessions[i]}`,
        `<p>${Number(i) === 2 ? "Più sicura nella virata; ricordare lo sguardo fuori dalla barca." : "Nessuna nota per questa sessione."}</p>${act("Apri storia allievo", "historyProfile", id, "full")}`,
      )
      break
    }
    case "session":
      showSheet(
        "Sessione",
        `<div class="grid-two">${sessions.map((s) => act(s, "sessionSelect", s)).join("")}</div>`,
      )
      break
    case "sessionSelect":
      closeSheet()
      {
        const [day, slot] = arg.split(" ")
        $(".session").innerHTML =
          `<span>${day}</span><strong>${slot}</strong><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`
      }
      toast("Sessione selezionata nella bozza")
      break
    case "retry":
      mode = "normal"
      $("#state-picker").value = mode
      render()
      toast("Nuovo tentativo")
      break
  }
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]")
  if (b) {
    if (b.dataset.doubleAction === "crewReturn") {
      const now = Date.now()
      const id = b.dataset.arg
      if (lastCrewTapId === id && now - lastCrewTapAt < 650) {
        lastCrewTapId = null
        lastCrewTapAt = 0
        handle(b.dataset.doubleAction, id, b)
        return
      }
      lastCrewTapId = id
      lastCrewTapAt = now
    } else {
      lastCrewTapId = null
      lastCrewTapAt = 0
    }
    handle(b.dataset.action, b.dataset.arg, b)
  } else if (event.target === $("#sheet")) closeSheet()
})
document.addEventListener("dblclick", (event) => {
  const target = event.target.closest("[data-double-action]")
  if (!target) return
  event.preventDefault()
  handle(target.dataset.doubleAction, target.dataset.arg, target)
})
document.addEventListener("keydown", (event) => {
  if ($("#sheet").hidden) return
  if (event.key === "Escape") closeSheet()
  if (event.key === "Tab") {
    const els = [
      ...$("#sheet").querySelectorAll("button,input,textarea,select,a"),
    ].filter((e) => !e.disabled)
    if (event.shiftKey && document.activeElement === els[0]) {
      event.preventDefault()
      els.at(-1).focus()
    } else if (!event.shiftKey && document.activeElement === els.at(-1)) {
      event.preventDefault()
      els[0].focus()
    }
  }
})
document.addEventListener("input", (event) => {
  if (event.target.id === "boat-input") {
    const nums = [
      ...new Set(event.target.value.split(/[\s,;]+/).filter(Boolean)),
    ]
    const type = $("#boat-type")?.value || "RS Quest"
    $("#boat-preview").textContent = nums.length
      ? type + " " + nums.join(" · ")
      : "Nessun numero inserito"
  }
  if (event.target.dataset.scanField) {
    const candidate = scanCandidates.find(
      (item) => item.id === Number(event.target.dataset.scanId),
    )
    if (candidate)
      candidate[event.target.dataset.scanField] = event.target.value
    const missing = scanCandidates.reduce(
      (total, item) => total + Number(!item.name.trim()) + Number(!item.birth),
      0,
    )
    const inserted = scanCandidates.filter(
      (item) => item.name.trim() && item.birth,
    ).length
    const missingEl = $('[data-scan-stat="missing"]')
    if (missingEl) missingEl.textContent = missing
    const insertedEl = $('[data-scan-stat="inserted"]')
    if (insertedEl) insertedEl.textContent = inserted
    const progress = $("#scan-progress")?.children[1]
    if (progress) progress.className = missing ? "needs-work" : "complete"
  }
  if (event.target.dataset.field && $("#save-state"))
    $("#save-state").textContent = "Salvato"
})
document.addEventListener("change", (event) => {
  if (event.target.id === "boat-type") {
    const input = $("#boat-input")
    if (input) input.dispatchEvent(new Event("input", { bubbles: true }))
  }
})
$("#page-picker").innerHTML = pages
  .map((p) => `<option value="${p[0]}">${p[0]} · ${p[1]}</option>`)
  .join("")
$("#page-picker").value = page
$("#page-picker").addEventListener("change", (e) => setPage(e.target.value))
$("#viewport-picker").addEventListener("change", (e) => {
  const [w, h] = e.target.value.split(",")
  $("#phone").style.width = w + "px"
  $("#phone").style.height = h + "px"
})
$("#roster-picker").addEventListener("change", (e) => {
  count = Number(e.target.value)
  initCrews()
  render()
})
$("#state-picker").addEventListener("change", (e) => {
  mode = e.target.value
  render()
})
render()
