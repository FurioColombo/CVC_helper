import {
  createLocalItalianSpeechProvider,
  type SpeechTranscriber,
} from "@/capabilities/speech"

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function createItalianSpeechFixture() {
  const sampleRate = 16_000
  const durationSeconds = 0.2
  const sampleCount = Math.round(sampleRate * durationSeconds)
  const bytesPerSample = 2
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, buffer.byteLength - 8, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, sampleCount * bytesPerSample, true)

  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.sin((Math.PI * index) / sampleCount)
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate)
    view.setInt16(44 + index * 2, sample * envelope * 12_000, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

/** Browser proof for real Web Audio decoding and the provider/model boundary. */
export async function runU03SpeechFixtureHarness() {
  let modelLoads = 0
  let decodedSamples = 0
  let decodedPeak = 0
  const transcriber: SpeechTranscriber = async (samples) => {
    decodedSamples = samples.length
    decodedPeak = samples.reduce(
      (peak, sample) => Math.max(peak, Math.abs(sample)),
      0,
    )
    return { text: "  virata precisa  " }
  }
  const provider = createLocalItalianSpeechProvider({
    loadTranscriber: async (onProgress) => {
      modelLoads += 1
      onProgress(25)
      onProgress(100)
      return transcriber
    },
  })
  const fixture = createItalianSpeechFixture()
  const firstProgress: string[] = []
  const firstText = await provider.transcribeAudio(fixture, {
    onProgress: ({ phase, percent }) =>
      firstProgress.push(`${phase}:${percent ?? "unknown"}`),
  })
  const secondProgress: string[] = []
  const secondText = await provider.transcribeAudio(fixture, {
    onProgress: ({ phase }) => secondProgress.push(phase),
  })

  return {
    audioBytes: fixture.size,
    decodedPeak,
    decodedSamples,
    firstProgress,
    firstText,
    modelLoads,
    secondProgress,
    secondText,
  }
}
