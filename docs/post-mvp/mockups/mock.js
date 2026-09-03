/* global document, location, history, setTimeout, clearTimeout */
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
    "Dati e conoscenza nello stesso percorso di modifica.",
    "Modifica è evidente? Il motivo che impedisce la cancellazione è concreto?",
  ],
  [
    "P05",
    "Conoscenza",
    "Taglia con un tap, nota vicino al nome.",
    "L'altezza guadagnata giustifica la disposizione dei cinque valori?",
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
    "Giallo per avaria e rosso per indisponibilità sono distinti?",
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
    "Venerdì e tutti i nomi sono visibili sul target grande? Prova gli avvisi.",
  ],
  [
    "P12",
    "Proposta Comandate",
    "Preferenze e conteggi live nello stesso riquadro.",
    "Prova sabato, tutti i giorni e metà settimana: la preview è chiara?",
  ],
  [
    "P13",
    "Persone Comandata",
    "Mai usati prima, già usati riconoscibili e selezionabili.",
    "Il rosso segnala la ripetizione senza suggerire un blocco?",
  ],
  [
    "P14",
    "Equipaggi",
    "Persone disponibili e destinazioni vicine.",
    "Seleziona una persona, poi uno slot o un'altra persona. Il contesto resta leggibile?",
  ],
  [
    "P15",
    "Barche della sessione",
    "Set dell'uscita distinto dalle persone in equipaggio.",
    "Togli una barca selezionata: l'equipaggio conserva le persone e perde solo la barca.",
  ],
  [
    "P16",
    "Leggi equipaggi",
    "Solo ciò che serve per leggere ad alta voce.",
    "Nomi e destinazione bastano? La lettura funziona anche senza numero barca?",
  ],
  [
    "P17",
    "Valutazioni",
    "Voti immediati, sessione vicina al titolo.",
    "Confronta 430 e 390: una riga dove entra, due righe comode altrove.",
  ],
  [
    "P18",
    "Riepilogo",
    "Sequenza, note e numero di voti; niente media numerica.",
    "Lo scorrimento della storia è riconoscibile senza allargare la pagina?",
  ],
  [
    "P19",
    "Storia allievo",
    "Cronologia esatta con le note della sessione.",
    "È facile ricostruire quando è stato dato un voto e perché?",
  ],
  [
    "P20",
    "Dettatura",
    "Permesso contestuale, feedback e testo da rivedere.",
    "Registra mostra un esempio di permesso; nessun microfono reale viene usato.",
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
const marks = ["++", "+", "=", "-", "--", "—"]
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
const boatNumbers = [2, 3, 7, 8, 11]
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
let noteContext = "initial"
let currentProfile = 0
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
  fewer = new Set(),
  midweek = false
let evaluation = {},
  notes = {},
  sizes = {},
  profileEditing = false,
  scanStep = 0,
  voiceStep = 0,
  unavailable = new Set(),
  selectedDay = 0
let pendingCrew = null,
  toastTimer,
  lastFocus
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
const name = (id) => {
  const p = person(id)
  return isWarning() && id === 19 ? "Alessandro Della Valle" : p.name
}
const minor = (id) =>
  person(id).age < 18
    ? '<span class="badge minor" aria-label="Minorenne">M</span>'
    : ""
const warn = (major = false) =>
  `<span class="warning ${major ? "major" : ""}" aria-label="${major ? "Avviso rosso" : "Avviso giallo"}">⚠</span>`
function initCrews() {
  assignments = Array.from({ length: Math.ceil((count - 2) / 2) }, (_, i) => [
    i * 2 < 16 ? i * 2 : null,
    i * 2 + 1 < 16 ? i * 2 + 1 : null,
  ])
  crewBoats = assignments.map((_, i) =>
    i === 5 ? "Mezzi" : (boatNumbers[i] ?? null),
  )
  selected = null
  sessionBoats = new Set(boatNumbers)
}
initCrews()
function personButton(id, action = "profile", arg = id, crew = false) {
  const p = person(id)
  return act(
    `<span class="person-name">${esc(name(id))} ${minor(id)}</span><span class="person-meta">${p.role ? `<span class="badge staff">${p.role}</span>` : crew ? `${sizes[id] || p.size}${id === 0 ? ' · <span class="badge" aria-label="Comandata corrente">C</span>' : ""}` : `${p.age} anni · ${p.sex}`}</span>`,
    action,
    arg,
    `${crew ? "crew-member" : "person"}${selected === id ? " selected" : ""}${isWarning() && id === 22 ? " disabled-person" : ""}`,
    `aria-pressed="${selected === id}"`,
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
  let start = midweek ? 2 : 0
  let n = count - (midweek ? (count === 23 ? 8 : 6) : 0)
  const d = 7 - start
  const base = Math.floor(n / d),
    rem = n % d
  let result = Array(7).fill(null)
  for (let i = start; i < 7; i++) result[i] = base
  const order = [...Array(d)]
    .map((_, i) => i + start)
    .sort((a, b) => Number(fewer.has(a)) - Number(fewer.has(b)) || a - b)
  order.slice(0, rem).forEach((i) => result[i]++)
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
  return result
}
function boatsMarkup(action = "boatDetail") {
  return `<div class="grid-two">${boatNumbers
    .map((n) => {
      const red = unavailable.has(n) || (isWarning() && n === 11),
        yellow = faults.some((f) => f.boat === n && f.state !== 2)
      return act(
        `<span class="boat-id"><span>Quest</span><strong>${n}</strong></span><div class="boat-state">${red ? `${warn(true)} Non disponibile` : yellow ? `${warn()} Avaria aperta` : "Disponibile"}</div>`,
        action,
        n,
        `boat-card${red ? " unavailable" : ""}${action === "boatToggle" && sessionBoats.has(n) ? " selected" : ""}`,
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
  if (profileEditing)
    return `<div class="notice">${isWarning() ? "Modifiche salvate solo quando i campi obbligatori sono validi." : "Modifiche salvate automaticamente"}</div>${field("Nome", p.name.split(" ")[0], "firstName")}${field("Cognome", p.surname, "surname")}${field("Nome visualizzato", p.name, "nickname")}${field("Data di nascita", dob, "dob", "date")}<label class="field">Sesso<select data-field="sex">${["F", "M", "Altro"].map((s) => `<option ${p.sex === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>${field("Telefono", "", "phone", "tel")}<h3>Taglia</h3>${sizeChoice(currentProfile)}<label class="field" style="margin-top:14px">Nota iniziale<textarea data-field="initialNote">${esc(initialNotes[currentProfile] || "")}</textarea></label><p class="small muted" id="save-state">Salvato</p>${act("Fine", "editProfile", "off", "primary full")}`
  return `<section class="panel"><div class="row"><h3 style="margin:0">${esc(p.name)} ${esc(p.surname)} ${minor(currentProfile)}</h3>${act("Modifica", "editProfile", "on", "compact")}</div><dl class="detail-grid"><div><dt>Età</dt><dd>${p.age} anni</dd></div><div><dt>Nascita</dt><dd>${dob.split("-").reverse().join("/")}</dd></div><div><dt>Sesso</dt><dd>${p.sex}</dd></div><div><dt>Taglia</dt><dd>${sizes[currentProfile] || p.size}</dd></div><div><dt>Telefono</dt><dd>—</dd></div><div><dt>Nome visualizzato</dt><dd>${esc(p.name)}</dd></div></dl></section><h3>Nota iniziale</h3><div class="panel"><p>${esc(initialNotes[currentProfile] || "Nessuna nota iniziale")}</p></div><h3>Valutazioni</h3>${act("Apri storia delle sessioni →", "goto", "P19", "full")}<h3>Disponibilità</h3>${act("Disattiva allieva", "disablePerson", "", "full")}<p class="muted small">Le informazioni storiche restano disponibili.</p><div style="margin-top:25px">${act("Elimina inserimento errato", "deletePerson", "", "danger full")}</div>`
}
function scanMarkup() {
  if (scanStep >= 2)
    return `<div class="notice">3 righe da controllare · 1 campo da completare</div><div class="stack">${[0, 1, 2].map((id, i) => `<section class="panel"><div class="row"><strong>${esc(people[id].name)} ${people[id].surname}</strong>${act("×", "removeCandidate", id, "", 'aria-label="Rimuovi riga"')}</div>${field("Nome", people[id].name, `candidate${id}`)}${field("Data di nascita", i === 1 ? "" : "2000-04-12", `candidateDate${id}`, "date")}${i === 1 ? '<span class="warning">Completa la data di nascita</span>' : ""}</section>`).join("")}</div><div style="margin-top:12px">${act("Conferma righe complete", "scanConfirm", "", "primary full")}</div>`
  return `<p class="muted">Inquadra nome, cognome e data di nascita.</p><div class="camera-frame"><div class="camera-label">Nome · Cognome · Data di nascita</div><div class="camera-sheet" id="camera-sheet"><div class="table-row"><strong>Nome</strong><strong>Cognome</strong><strong>Nascita</strong></div><div class="table-row"><span>Giulia</span><span>Moretti</span><span>18/03/2009</span></div><div class="table-row"><span>Luca</span><span>Bianchi</span><span>07/06/2002</span></div><div class="table-row"><span>Anna</span><span>Riva</span><span>12/04/2000</span></div></div><div class="camera-guide"></div></div><div class="toolbar">${act("Ruota ↻", "rotate")}${act("Ritaglia", "crop")}</div>${act(scanStep === 0 ? "Scatta foto" : "Leggi allievi", "scanNext", "", "primary full")}<div style="margin-top:8px">${act("Scegli foto o screenshot", "scanFile", "", "full")}</div><p class="small muted">Escludi le altre sezioni del foglio quando possibile.</p>`
}
function dutyMarkup() {
  const groups = duties()
  return `<div class="toolbar">${act("Proposta", "goto", "P12")}${act("Avvisi" + (isWarning() ? " · 2" : ""), "dutyWarnings")}</div>${isWarning() ? '<div class="notice error">1 allievo non assegnato · 1 assegnato due volte</div>' : ""}<div class="duty-grid">${groups.map((ids, i) => act(`<span class="duty-title"><strong>${days[i]}</strong><span>${ids.length}${isWarning() && (i === 0 || i === 4) ? " " + warn(true) : ""}</span></span>${ids.map((id) => `<span class="duty-person">${esc(name(id))} ${minor(id)} ${isWarning() && id === 0 ? warn(true) : ""}</span>`).join("")}`, "dutyDay", i, `duty-card${isWarning() && (i === 0 || i === 4) ? " has-warning" : ""}`)).join("")}</div>`
}
function proposalMarkup() {
  const caps = capacities()
  return `<div class="row"><strong>${midweek ? count - (count === 23 ? 8 : 6) : count} allievi disponibili</strong>${act(midweek ? "Inizio settimana" : "Metà settimana", "midweek", "", "compact")}</div><h3>Giorni con meno persone</h3><div class="preview-panel"><div class="day-options">${shortDays.map((d, i) => act(d, "fewer", i, "day-button", `aria-label="${days[i]} con meno persone" aria-pressed="${fewer.has(i)}" ${midweek && i < 2 ? "disabled" : ""}`)).join("")}</div><div class="day-preview">${caps.map((c) => `<span>${c ?? "✓"}</span>`).join("")}</div><p class="small muted" style="text-align:center">Anteprima · ${midweek ? "i turni completati restano invariati" : "nessuna modifica ancora applicata"}</p></div><h3>Preferenze</h3><label class="row panel"><span>Distribuisci i minori</span><input type="checkbox" checked style="width:44px" /></label><label class="row panel" style="margin-top:7px"><span>Bilancia il sesso</span><input type="checkbox" checked style="width:44px" /></label><h3>Restano la prossima settimana</h3><div class="grid-two">${[0, 2, 4, 7].map((id) => act(esc(name(id)), "stay", id, "", 'aria-pressed="false"')).join("")}</div><p class="muted small">Preferiti per venerdì, fino ai posti necessari.</p>${act("Genera proposta", "proposalConfirm", "", "primary full")}`
}
function dutyPeopleMarkup() {
  const groups = duties(),
    uses = new Map()
  groups.flat().forEach((id) => uses.set(id, (uses.get(id) || 0) + 1))
  const available = all().filter((p) => (uses.get(p.id) || 0) === 0),
    used = all().filter((p) => (uses.get(p.id) || 0) > 0)
  return `<div class="notice">${days[selectedDay]} · ${groups[selectedDay].map((id) => name(id)).join(", ")}</div><h3>Mai assegnati · ${available.length}</h3>${available.length ? `<div class="grid-two">${available.map((p) => personButton(p.id, "dutyAssign")).join("")}</div>` : '<p class="muted">Tutti hanno già una comandata.</p>'}<h3>Già assegnati</h3><div class="grid-two">${used.map((p) => act(`<span class="person-name">${esc(name(p.id))} ${minor(p.id)}</span><span class="person-meta">${uses.get(p.id) > 1 ? warn(true) + " Più volte" : "✓ Una volta"}</span>`, "dutyAssign", p.id, "person")).join("")}</div>`
}
function crewMarkup() {
  const assigned = assignments.flat().filter((x) => x !== null),
    pool = all().filter(
      (p) => !assigned.includes(p.id) && !terra.includes(p.id),
    )
  return `<div class="toolbar crew-toolbar">${act("Barche", "goto", "P15")}${act("Leggi", "goto", "P16")}${act("Altro", "crewMore")}</div><div class="crew-pool"><div class="row"><h3 style="margin:0 0 7px">Disponibili · ${pool.length}</h3>${selected !== null ? act("Annulla selezione", "cancelSelect", "", "compact") : ""}</div><div class="grid-two">${pool.map((p) => personButton(p.id, "selectPerson", p.id)).join("")}</div>${!pool.length ? '<p class="small muted">Tutti gli allievi sono collocati.</p>' : ""}</div><div class="crew-grid">${assignments.map((ids, i) => `<section class="crew-card">${act(`<span>${crewBoats[i] ? (crewBoats[i] === "Mezzi" ? "Mezzi" : `Quest <strong>${crewBoats[i]}</strong>`) : `Equipaggio ${i + 1}`}</span>${unavailable.has(crewBoats[i]) || (crewBoats[i] === 11 && isWarning()) ? warn(true) : faults.some((f) => f.boat === crewBoats[i] && f.state !== 2) ? warn() : "<span>⌄</span>"}`, "crewDestination", i, "crew-destination", `aria-label="Destinazione equipaggio ${i + 1}"`)}<div class="crew-members">${ids.map((id, j) => (id === null ? act("＋", "slot", `${i}:${j}`, "crew-member", `aria-label="Posto libero equipaggio ${i + 1}"`) : personButton(id, "selectPerson", id, true))).join("")}</div></section>`).join("")}</div><div class="crew-footer">${act(`A terra · ${terra.length}`, "terra")}${act("Volontari · 3", "staff", "", "compact")}</div>`
}
function boatsSessionMarkup() {
  return `<div class="notice">Tocca una barca per includerla o escluderla dall'uscita.</div>${boatsMarkup("boatToggle")}<h3>Assegnazioni attuali</h3><div class="stack">${assignments
    .slice(0, 5)
    .map(
      (ids, i) =>
        `<div class="panel"><div class="row"><strong>Equipaggio ${i + 1}</strong><span>${crewBoats[i] ? (crewBoats[i] === "Mezzi" ? "Mezzi" : "Quest " + crewBoats[i]) : "Senza barca"} ${isWarning() && crewBoats[i] === 11 ? warn(true) : ""}</span></div><p class="muted">${ids
          .filter((id) => id !== null)
          .map((id) => esc(name(id)))
          .join(" / ")}</p></div>`,
    )
    .join(
      "",
    )}</div><div style="margin-top:10px">${act("Torna agli equipaggi", "goto", "P14", "primary full")}</div>`
}
function evaluationMarkup() {
  return `<div class="toolbar">${act("Allievi", "evalView", "all", "selected")}${act("Equipaggi", "evalView", "crew")}${act("Riepilogo", "goto", "P18")}</div><div id="evaluation-list">${evaluationRows(all().map((p) => p.id))}</div>`
}
function evaluationRows(ids) {
  return ids
    .map(
      (id) =>
        `<div class="evalrow"><div class="eval-name">${esc(name(id))}${terra.includes(id) ? '<span class="muted small"> · A terra</span>' : ""}</div>${marks.map((m) => act(m, "mark", `${id}:${m}`, `mark ${m.includes("+") ? "pos" : m === "-" || m === "--" ? "neg" : ""}`, `aria-label="${esc(name(id))}: ${m === "—" ? "nessuna valutazione" : m}" aria-pressed="${(evaluation[id] || "—") === m}"`)).join("")}${act(notes[id] ? "●" : "✎", "note", id, "note-button", `aria-label="Nota di ${esc(name(id))}"`)}</div>`,
    )
    .join("")
}
function overviewMarkup() {
  return `<div class="toolbar">${act("Alfabetico", "sortOverview", "alpha", "selected")}${act("Valutazione", "sortOverview", "score")}</div><div class="stack" id="overview-list">${overviewRows(all())}</div>`
}
function overviewRows(list) {
  return list
    .map(
      (p) =>
        `<section class="panel" style="min-width:0;padding:8px"><div class="row">${act(esc(name(p.id)), "historyProfile", p.id, "plain compact")}<span class="small muted">6 voti</span></div><div class="history-strip" aria-label="Storia di ${esc(name(p.id))}">${sessions.map((s, i) => act(`${i < 7 ? ["=", "+", "+*", "++", "—", "+", "="][i] : "—"}<small>${s}</small>`, "historyNote", `${p.id}:${i}`)).join("")}</div></section>`,
    )
    .join("")
}
function voiceMarkup() {
  if (voiceStep === 0)
    return `<div class="panel"><h3>Nota iniziale · Giulia</h3><p class="muted">Puoi dettare una nota e rivedere il testo.</p>${act("Registra", "voiceStart", "", "primary full")}</div>`
  if (voiceStep === 1)
    return `<div class="panel"><h3>Esempio di richiesta del browser</h3><p>Consenti l'accesso al microfono per registrare questa nota?</p><div class="toolbar">${act("Non consentire", "voiceDeny")}${act("Consenti", "voiceAllow", "", "primary")}</div></div>`
  if (voiceStep === 2)
    return `<div class="panel"><div class="row"><strong>Registrazione in corso</strong><span class="small">00:12</span></div><div class="recording" aria-hidden="true">${"<span></span>".repeat(13)}</div>${act("Termina registrazione", "voiceStop", "", "primary full")}${act("Annulla", "voiceCancel", "", "plain full")}</div>`
  if (voiceStep === 4)
    return `<div class="notice error">Microfono non disponibile. Consenti il microfono nelle impostazioni del browser e riprova.</div>${act("Riprova", "voiceStart", "", "primary full")}`
  return `<div class="panel"><h3>Rivedi il testo</h3><textarea aria-label="Testo trascritto">${esc(initialNotes[currentProfile] || "")}</textarea><div style="margin-top:12px">${act("Usa questo testo", "voiceUse", "", "primary full")}</div>${act("Registra di nuovo", "voiceStart", "", "plain full")}</div>`
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
      return `<div class="home-course"><div class="course-code">D2</div><p>Settimana 35 <span class="muted">/ 2026</span></p></div><div class="grid-two">${[
        ["Allievi", "P03", "AL"],
        ["Barche", "P08", "BA"],
        ["Comandate", "P11", "CO"],
        ["Equipaggi", "P14", "EQ"],
        ["Valutazioni", "P17", "VA"],
        ["Volontari", "P10", "VO"],
      ]
        .map(([title, id, abbr]) =>
          act(
            `<span class="home-mark">${abbr}</span><span>${title} <span style="float:right">→</span></span>`,
            "goto",
            id,
            "home-card",
          ),
        )
        .join(
          "",
        )}</div><p class="small muted" style="margin-top:20px">Corso Deriva · Livello 2</p>`
    case "P02":
      return `<h3>Famiglia</h3><div class="segments">${act("Deriva", "choice", "", "selected")}${act("Cabinato", "choice")}</div><h3>Livello</h3><div class="segments">${[1, 2, 3, 4, 5].map((n) => act(n, "choice", "", n === 2 ? "selected" : "")).join("")}</div><h3>Il tuo corso</h3><div class="panel"><strong style="font-size:24px">D2 35 2026</strong><p class="muted">Settimana e anno dal calendario.</p></div><div style="margin-top:18px">${act("Crea corso", "goto", "P01", "primary full")}</div>`
    case "P03":
      return rosterMarkup()
    case "P04":
      return profileMarkup()
    case "P05":
      return `<div class="stack">${all()
        .map(
          (p) =>
            `<section class="panel knowledge-row"><strong class="knowledge-name">${esc(name(p.id))} ${minor(p.id)}</strong>${sizeChoice(p.id)}${act(initialNotes[p.id] ? "●" : "✎", "note", p.id, "note-button", `aria-label="Nota di ${esc(name(p.id))}"`)}${initialNotes[p.id] ? `<p class="knowledge-preview">${esc(initialNotes[p.id])}</p>` : ""}</section>`,
        )
        .join("")}</div>`
    case "P06":
      return scanMarkup()
    case "P07":
      return `<label class="field">Tipo di barca<select><option>RS Quest</option><option>RS Toura</option><option>Laser Vago</option></select></label><label class="field">Numeri delle barche<textarea id="boat-input" placeholder="2 3 7, 8; 11">2 3 7, 8; 11</textarea></label><p class="small muted">Separa con spazi, virgole, punti e virgola o vai a capo.</p><div class="panel" id="boat-preview">Quest 2 · 3 · 7 · 8 · 11</div><div style="margin-top:15px">${act("Aggiungi barche", "boatsAdd", "", "primary full")}</div>`
    case "P08":
      return boatsMarkup()
    case "P09":
      return `<div class="stack">${faults.map((f, i) => `<section class="panel fault">${act(`<span class="boat-id"><span>Quest</span><strong>${f.boat}</strong></span><span class="preview">${esc(f.text)}</span>`, "faultDetail", i, "fault-open")}<div class="segments">${["Aperta", "Comunicata", "Risolta"].map((s, j) => act(s, "faultState", `${i}:${j}`, "", `aria-pressed="${f.state === j}"`)).join("")}</div></section>`).join("")}</div>`
    case "P10":
      return `<div class="stack">${staff.map((p) => `<section class="panel row"><strong>${p.name}</strong>${act(p.role, "editStaff", p.id, "compact")}</section>`).join("")}</div><div style="margin-top:16px">${act("Aggiungi volontario", "editStaff", 100, "primary full")}</div>`
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
      return assignments
        .map(
          (ids, i) =>
            `<div class="read-row">${crewBoats[i] ? `<small>${crewBoats[i] === "Mezzi" ? "Mezzi" : "Quest " + crewBoats[i]}</small>` : ""}${
              ids
                .filter((id) => id !== null)
                .map((id) => esc(name(id)))
                .join(" / ") || '<span class="muted">Posti da completare</span>'
            }</div>`,
        )
        .join("")
    case "P17":
      return evaluationMarkup()
    case "P18":
      return overviewMarkup()
    case "P19":
      return `<div class="notice">${esc(name(currentProfile))} · storia del corso</div><div class="stack">${sessions.map((s, i) => `<section class="panel"><div class="row"><strong>${s}</strong><strong>${["=", "+", "+", "++", "—", "+", "="][i] || "—"}</strong></div>${i === 2 ? "<p>Più sicura nella virata; ricordare lo sguardo fuori dalla barca.</p>" : ""}</section>`).join("")}</div>`
    case "P20":
      return voiceMarkup()
    default:
      return ""
  }
}
function render() {
  const p = pages.find((p) => p[0] === page)
  $("#page-id").textContent = `${p[0]} · REVISIONE 1`
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
      P20: "Dettatura",
    }[page] || p[1]
  const hasSession = ["P14", "P15", "P16", "P17"].includes(page)
  let right = hasSession
    ? act("Lun PM ⌄", "session", "", "session")
    : page === "P03"
      ? act("＋", "newStudent", "", "", 'aria-label="Aggiungi allievo"')
      : page === "P08"
        ? act("＋", "goto", "P07", "", 'aria-label="Aggiungi barca"')
        : page === "P09"
          ? act("＋", "newFault", "", "", 'aria-label="Aggiungi avaria"')
          : page === "P01"
            ? act("⚙", "settings", "", "", 'aria-label="Impostazioni"')
            : ""
  $("#app-header").innerHTML =
    `<div class="head-row">${page === "P01" ? '<img class="logo" src="assets/logo-fcvc.avif" alt="Centro Velico Caprera" />' : `<div class="head-title">${act("‹", "back", "", "back", 'aria-label="Indietro"')}<h2>${title}</h2></div>`}${right}</div>`
  $("#app-content").innerHTML =
    (mode === "error"
      ? `<div class="notice error">Modifica non salvata. ${act("Riprova", "retry", "", "compact")}</div>`
      : "") + content()
  $("#crew-status").hidden = page !== "P14" || mode === "empty"
  $("#crew-status").innerHTML =
    `<span class="crew-counter">Collocati ${assignments.flat().filter((id) => id !== null && id < 100).length + terra.filter((id) => id < 100).length}/${count}</span>`
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
      break
    case "profile":
      currentProfile = Number(arg)
      setPage("P04")
      break
    case "historyProfile":
      currentProfile = Number(arg)
      setPage("P19")
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
        `<label class="field">Testo<textarea id="note-draft">${esc((noteContext === "initial" ? initialNotes : notes)[arg] || "")}</textarea></label><div class="toolbar">${act("Detta", "voiceFromNote")}${act("Fine", "noteSave", arg, "primary")}</div>`,
      )
      break
    case "noteSave":
      ;(noteContext === "initial" ? initialNotes : notes)[arg] =
        $("#note-draft").value
      closeSheet()
      render()
      toast("Nota aggiornata")
      break
    case "voiceFromNote":
      setPage("P20")
      break
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
    case "settings":
      showSheet(
        "Impostazioni",
        `<div class="panel"><strong>D2 · Settimana 35 · 2026</strong><p>Corso attivo</p></div><p class="muted small">Versione di riferimento 0.1.0</p>`,
      )
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
      button.closest("section").remove()
      break
    case "scanConfirm":
      toast("Completa o rimuovi le righe con dati obbligatori mancanti")
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
    case "newFault":
      showSheet(
        "Nuova avaria",
        `<label class="field">Barca<select><option>Quest 3</option><option>Quest 7</option></select></label><label class="field">Descrizione<textarea></textarea></label><div class="toolbar">${act("Detta", "voiceFromNote")}${act("Salva", "demoSaved", "", "primary")}</div>`,
      )
      break
    case "editStaff":
      showSheet(
        "Volontario",
        `${field("Nome", person(Number(arg)).name, "staffName")}<h3>Ruolo</h3><div class="segments">${["ADV", "IS", "CT"].map((r) => act(r, "choice", "", person(Number(arg)).role === r ? "selected" : "")).join("")}</div><div style="margin-top:15px">${act("Salva", "demoSaved", "", "primary full")}</div>`,
      )
      break
    case "demoSaved":
      closeSheet()
      toast("Interazione di salvataggio mostrata")
      break
    case "dutyDay":
      selectedDay = Number(arg)
      showSheet(
        days[selectedDay],
        `<p>${duties()
          .at(selectedDay)
          .map((id) => esc(name(id)))
          .join(
            " · ",
          )}</p>${isWarning() ? '<div class="notice error">Giulia compare anche in un altro turno. Puoi mantenere questa scelta.</div>' : ""}${act("Modifica persone", "goto", "P13", "primary full")}`,
      )
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
      render()
      break
    case "fewer": {
      const d = Number(arg)
      if (fewer.has(d)) fewer.delete(d)
      else fewer.add(d)
      render()
      break
    }
    case "stay":
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("aria-pressed") !== "true",
      )
      break
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
      } else selected = id
      render()
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
    case "crewDestination":
      pendingCrew = Number(arg)
      showSheet(
        `Destinazione · equipaggio ${pendingCrew + 1}`,
        `<div class="grid-two">${[...sessionBoats].map((n) => act(`Quest ${n}${unavailable.has(n) || (isWarning() && n === 11) ? " " + warn(true) : n === 3 ? " " + warn() : ""}`, "assignBoat", n)).join("")}${act("Non assegnato", "assignBoat", "none")}${act("Mezzi", "assignBoat", "mezzi")}</div>`,
      )
      break
    case "assignBoat": {
      const n = arg === "none" ? null : arg === "mezzi" ? "Mezzi" : Number(arg)
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
    case "boatToggle": {
      const n = Number(arg),
        affected = crewBoats.flatMap((b, i) => (b === n ? [i + 1] : []))
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
      evaluation[id] = m
      button
        .closest(".evalrow")
        .querySelectorAll(".mark")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)))
      toast("Valutazione aggiornata")
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
      $(".session").textContent = arg + " ⌄"
      toast("Sessione selezionata nella bozza")
      break
    case "voiceStart":
      voiceStep = 1
      render()
      break
    case "voiceAllow":
      voiceStep = 2
      render()
      break
    case "voiceDeny":
      voiceStep = 4
      render()
      break
    case "voiceStop":
      voiceStep = 3
      render()
      break
    case "voiceCancel":
      voiceStep = 0
      render()
      break
    case "voiceUse":
      initialNotes[0] = "Ha già frequentato D1. Buona autonomia nelle manovre."
      voiceStep = 0
      setPage("P05")
      toast("Testo di esempio inserito")
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
  if (b) handle(b.dataset.action, b.dataset.arg, b)
  else if (event.target === $("#sheet")) closeSheet()
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
    $("#boat-preview").textContent = nums.length
      ? "Quest " + nums.join(" · ")
      : "Nessun numero inserito"
  }
  if (event.target.dataset.field && $("#save-state"))
    $("#save-state").textContent = "Salvato"
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
