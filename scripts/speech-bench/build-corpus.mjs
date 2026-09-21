import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const dsp = await import(pathToFileURL(process.argv[3]).href)
const OUT = process.argv[2]
mkdirSync(`${OUT}/noisy`, { recursive: true })

const clean = JSON.parse(readFileSync(`${OUT}/manifest-clean.json`, "utf8"))
const loaded = clean.map((entry) => {
  const { samples, sampleRate } = dsp.readWav(
    readFileSync(`${OUT}/clean/${entry.file}`),
  )
  const f0 = dsp.estimateF0(samples, sampleRate)
  return { ...entry, samples, sampleRate, f0 }
})

for (const clip of loaded) {
  clip.voice = clip.f0 === null ? "unknown" : clip.f0 < 160 ? "male" : "female"
}
console.log("=== estimated voice labels (median F0) ===")
for (const c of loaded) {
  console.log(
    c.file,
    c.f0 ? `${c.f0.toFixed(0)} Hz` : "n/a",
    "->",
    c.voice,
    `${c.sampleRate}Hz`,
  )
}
const counts = loaded.reduce(
  (a, c) => ({ ...a, [c.voice]: (a[c.voice] ?? 0) + 1 }),
  {},
)
console.log("counts:", JSON.stringify(counts))

const CONDITIONS = [
  { id: "clean", kind: null },
  { id: "wind-15", kind: "wind", snr: 15 },
  { id: "wind-5", kind: "wind", snr: 5 },
  { id: "babble-10", kind: "babble", snr: 10 },
  { id: "white-10", kind: "white", snr: 10 },
  { id: "pink-5", kind: "pink", snr: 5 },
  { id: "quiet", kind: null, gain: 0.12 },
  { id: "clipped", kind: null, gain: 6 },
]

const manifest = []
for (const clip of loaded) {
  const pool = loaded
    .filter((o) => o !== clip)
    .slice(0, 3)
    .map((o) => o.samples)
  for (const condition of CONDITIONS) {
    let samples = clip.samples
    if (condition.kind) {
      const noise = dsp.makeNoise(
        condition.kind,
        samples.length,
        clip.sampleRate,
        pool,
      )
      samples = dsp.mixAtSnr(samples, noise, condition.snr)
    }
    if (condition.gain) samples = dsp.applyGain(samples, condition.gain)
    const file = `${clip.file.replace(".wav", "")}__${condition.id}.wav`
    writeFileSync(
      `${OUT}/noisy/${file}`,
      dsp.writeWav(samples, clip.sampleRate),
    )
    manifest.push({
      file,
      source: clip.file,
      text: clip.text,
      voice: clip.voice,
      f0: clip.f0 ? Math.round(clip.f0) : null,
      condition: condition.id,
      sampleRate: clip.sampleRate,
    })
  }
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(
  "corpus entries:",
  manifest.length,
  "conditions:",
  CONDITIONS.length,
)
