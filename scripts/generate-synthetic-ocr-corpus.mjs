import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { fileURLToPath } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const fixtureDirectory = path.join(
  repositoryRoot,
  "tests",
  "fixtures",
  "ocr-synthetic",
)

const people = [
  {
    id: "p01",
    printedName: "Veldoro Nurelia",
    firstName: "Nurelia",
    surname: "Veldoro",
    dateOfBirth: "2008-02-03",
    age: 16,
    phone: "000 000 0001",
  },
  {
    id: "p02",
    printedName: "Dalla Brumera Zovelia",
    firstName: "Zovelia",
    surname: "Dalla Brumera",
    dateOfBirth: "2007-05-14",
    age: 17,
    phone: "000 000 0002",
  },
  {
    id: "p03",
    printedName: "Fiorvane Drelina",
    firstName: "Drelina",
    surname: "Fiorvane",
    dateOfBirth: "2006-08-21",
    age: 18,
    phone: "000 000 0003",
  },
  {
    id: "p04",
    printedName: "Da Nuvellia Elareno",
    firstName: "Elareno",
    surname: "Da Nuvellia",
    dateOfBirth: "2005-11-06",
    age: 18,
    phone: "000 000 0004",
  },
  {
    id: "p05",
    printedName: "Torvessa Alunera",
    firstName: "Alunera",
    surname: "Torvessa",
    dateOfBirth: "2009-01-19",
    age: 15,
    phone: "000 000 0005",
  },
  {
    id: "p06",
    printedName: "Virello Elaria",
    firstName: "Elaria",
    surname: "Virello",
    dateOfBirth: "2004-04-28",
    age: 20,
    phone: "000 000 0006",
  },
  {
    id: "p07",
    printedName: "Della Veralune Nireva",
    firstName: "Nireva",
    surname: "Della Veralune",
    dateOfBirth: "2007-07-09",
    age: 17,
    phone: "000 000 0007",
  },
  {
    id: "p08",
    printedName: "Solmeria Thalira Quenora",
    firstName: "Thalira Quenora",
    surname: "Solmeria",
    dateOfBirth: "2005-09-12",
    age: 18,
    phone: "000 000 0008",
    ambiguousCompound: true,
  },
  {
    id: "p09",
    printedName: "Qavornellia Liorea",
    firstName: "Liorea",
    surname: "Qavornellia",
    dateOfBirth: "2008-12-01",
    age: 15,
    phone: "000 000 0009",
  },
  {
    id: "p10",
    printedName: "Nivaldi Veloria",
    firstName: "Veloria",
    surname: "Nivaldi",
    dateOfBirth: "2006-03-25",
    age: 18,
    phone: "000 000 0010",
  },
]
const referenceDate = "2024-09-13"

const variants = [
  {
    file: "roster-soft-skew.png",
    rotationDegrees: -0.55,
    lighting: "soft-left-to-right",
    base: "#f7f5ef",
    shadowOpacity: 0.07,
  },
  {
    file: "roster-warm-light.png",
    rotationDegrees: 0.75,
    lighting: "warm-top-right-falloff",
    base: "#f4f0e5",
    shadowOpacity: 0.12,
  },
  {
    file: "roster-dim-corner.png",
    rotationDegrees: -1.05,
    lighting: "mild-bottom-left-vignette",
    base: "#f1f0eb",
    shadowOpacity: 0.15,
  },
  {
    file: "roster-wide-columns.png",
    rotationDegrees: -0.45,
    lighting: "soft-right-falloff",
    base: "#f6f3e9",
    shadowOpacity: 0.1,
    layout: "wide-columns",
  },
]

const firstRowY = 265
const rowHeight = 72

function layoutFor(variant) {
  if (variant.layout === "wide-columns") {
    return {
      width: 2200,
      height: 1120,
      nameX: 120,
      phoneX: 1250,
      ageX: 1640,
      dateX: 1910,
    }
  }
  return {
    width: 1800,
    height: 1120,
    nameX: 120,
    phoneX: 852,
    ageX: 1186,
    dateX: 1430,
  }
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function rowMarkup(person, index, layout) {
  const y = firstRowY + index * rowHeight
  const birth = person.dateOfBirth.split("-").reverse().join("/")
  return `
    <line x1="92" y1="${y + 32}" x2="${layout.width - 92}" y2="${y + 32}" stroke="#aeb4b0" stroke-width="1.25" opacity="0.68" />
    <text x="${layout.nameX}" y="${y}" class="name">${escapeXml(person.printedName)}</text>
    <text x="${layout.phoneX}" y="${y}" class="phone">${escapeXml(person.phone)}</text>
    <text x="${layout.ageX}" y="${y}" class="age">${person.age} anni</text>
    <text x="${layout.dateX}" y="${y}" class="date">${birth}</text>
  `
}

function makeSvg(variant) {
  const layout = layoutFor(variant)
  const { width, height } = layout
  const rows = people
    .map((person, index) => rowMarkup(person, index, layout))
    .join("")
  const paperWidth = width - 76
  const background = `
    <rect width="${width}" height="${height}" fill="#d9d7d1" />
    <rect width="${width}" height="${height}" fill="url(#ambient)" />
    <rect x="38" y="28" width="${paperWidth}" height="1064" rx="5" fill="${variant.base}" stroke="#c8c5bd" stroke-width="2" />
    <rect x="38" y="28" width="${paperWidth}" height="1064" rx="5" fill="url(#paper-light)" />
    <g transform="rotate(${variant.rotationDegrees} ${width / 2} ${height / 2})">
      <text x="120" y="105" class="title">ELENCO PARTECIPANTI</text>
      <text x="120" y="143" class="subhead">Registro di prova · dati inventati</text>
      <text x="${layout.nameX}" y="211" class="head">COGNOME E NOME</text>
      <text x="${layout.phoneX}" y="211" class="head">TELEFONO</text>
      <text x="${layout.ageX}" y="211" class="head">ETÀ</text>
      <text x="${layout.dateX}" y="211" class="head">DATA DI NASCITA</text>
      <line x1="92" y1="226" x2="${width - 92}" y2="226" stroke="#747c7a" stroke-width="2" opacity="0.75" />
      ${rows}
      <line x1="92" y1="${firstRowY + people.length * rowHeight - 40}" x2="${width - 92}" y2="${firstRowY + people.length * rowHeight - 40}" stroke="#aeb4b0" stroke-width="1.25" opacity="0.68" />
      <text x="120" y="${height - 76}" class="footer">FAC-SIMILE · SOLO PER VERIFICA SOFTWARE</text>
    </g>
    <rect width="${width}" height="${height}" fill="url(#vignette)" opacity="${variant.shadowOpacity}" />
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="ambient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.24" />
        <stop offset="0.53" stop-color="#ffffff" stop-opacity="0" />
        <stop offset="1" stop-color="#6c665a" stop-opacity="0.12" />
      </linearGradient>
      <linearGradient id="paper-light" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.12" />
        <stop offset="0.64" stop-color="#ffffff" stop-opacity="0.01" />
        <stop offset="1" stop-color="#897b64" stop-opacity="0.09" />
      </linearGradient>
      <radialGradient id="vignette" cx="47%" cy="48%" r="72%">
        <stop offset="48%" stop-color="#ffffff" stop-opacity="0" />
        <stop offset="100%" stop-color="#514b42" stop-opacity="1" />
      </radialGradient>
    </defs>
    <style>
      .title { font: 700 31px Arial, sans-serif; fill: #202a2b; letter-spacing: 0.4px; }
      .subhead { font: 400 19px Arial, sans-serif; fill: #66706e; }
      .head { font: 700 19px Arial, sans-serif; fill: #47514f; letter-spacing: 0.15px; }
      .name { font: 500 29px Arial, sans-serif; fill: #172223; }
      .phone, .age, .date { font: 400 27px Arial, sans-serif; fill: #263132; }
      .footer { font: 700 15px Arial, sans-serif; fill: #79807c; letter-spacing: 0.9px; }
    </style>
    ${background}
  </svg>`
}

await mkdir(fixtureDirectory, { recursive: true })

for (const variant of variants) {
  const svg = Buffer.from(makeSvg(variant))
  await sharp(svg)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(path.join(fixtureDirectory, variant.file))
}

const truth = {
  schemaVersion: 1,
  synthetic: true,
  description:
    "Wholly fabricated roster values and names generated only for OCR regression. No personal records are used.",
  referenceDate,
  printedNameOrder: "surname-given",
  requiredFields: ["firstName", "surname", "dateOfBirth", "phone"],
  readableFields: ["firstName", "surname", "dateOfBirth", "age", "phone"],
  expectedAmbiguousNameIds: people
    .filter((person) => person.ambiguousCompound)
    .map((person) => person.id),
  variants: variants.map((variant) => ({
    file: variant.file,
    rotationDegrees: variant.rotationDegrees,
    lighting: variant.lighting,
    rowRules: true,
    layout: variant.layout ?? "standard",
    columnFragmentationExpected: variant.layout === "wide-columns",
    people,
  })),
}

await writeFile(
  path.join(fixtureDirectory, "truth.json"),
  `${JSON.stringify(truth, null, 2)}\n`,
)

console.log(
  `Generated ${variants.length} synthetic OCR sheets in ${fixtureDirectory}`,
)
