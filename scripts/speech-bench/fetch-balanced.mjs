import { mkdirSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const dsp = await import(pathToFileURL(process.argv[3]).href)
const OUT = process.argv[2]
mkdirSync(`${OUT}/clean`, { recursive: true })

const candidates = []
for (const offset of [0, 60, 120, 180, 240, 300, 360, 420, 480]) {
  const url =
    `https://datasets-server.huggingface.co/rows?dataset=PolyAI%2Fminds14` +
    `&config=it-IT&split=train&offset=${offset}&length=12`
  const json = await (await fetch(url)).json()
  for (const r of json.rows ?? []) {
    const text = (r.row.transcription ?? "").trim()
    const src = r.row.audio?.[0]?.src
    if (src && text.split(/\s+/).length >= 6) candidates.push({ text, src })
  }
}
console.log("candidates:", candidates.length)

const scored = []
for (const item of candidates) {
  try {
    const bytes = Buffer.from(await (await fetch(item.src)).arrayBuffer())
    const { samples, sampleRate } = dsp.readWav(bytes)
    const f0 = dsp.estimateF0(samples, sampleRate)
    if (f0) scored.push({ ...item, bytes, f0, sampleRate })
  } catch {
    // A clip that will not fetch or decode is simply not a candidate.
  }
}
scored.sort((a, b) => a.f0 - b.f0)
console.log(
  "scored:",
  scored.length,
  "f0 range:",
  scored[0]?.f0.toFixed(0),
  "-",
  scored.at(-1)?.f0.toFixed(0),
)

const male = scored.filter((s) => s.f0 < 165).slice(0, 7)
const female = scored.filter((s) => s.f0 >= 180 && s.f0 < 260).slice(0, 7)
const picked = [...male, ...female]

const manifest = []
picked.forEach((item, index) => {
  const voice = item.f0 < 165 ? "male" : "female"
  const name = `${voice}${String(index + 1).padStart(2, "0")}.wav`
  writeFileSync(`${OUT}/clean/${name}`, item.bytes)
  manifest.push({
    file: name,
    text: item.text,
    voice,
    f0: Math.round(item.f0),
    sampleRate: item.sampleRate,
  })
  console.log(name, `${Math.round(item.f0)}Hz`, "|", item.text.slice(0, 50))
})
writeFileSync(`${OUT}/manifest-clean.json`, JSON.stringify(manifest, null, 2))
console.log("male:", male.length, "female:", female.length)
