export type SpeechTranscriptionPhase = "loading" | "processing"

export interface SpeechTranscriptionProgress {
  phase: SpeechTranscriptionPhase
  /** Model download/load percentage when the runtime can measure it. */
  percent?: number
}

export interface SpeechTranscriptionOptions {
  onProgress?: (progress: SpeechTranscriptionProgress) => void
}

export interface SpeechTranscriptionProvider {
  prepare(options?: SpeechTranscriptionOptions): Promise<void>
  transcribeAudio(
    audio: Blob,
    options?: SpeechTranscriptionOptions,
  ): Promise<string>
}

export interface SpeechTranscriberOptions {
  [key: string]: unknown
  language: "italian"
  task: "transcribe"
  no_repeat_ngram_size?: number
  repetition_penalty?: number
  temperature?: number
  condition_on_previous_text?: boolean
}

export type SpeechTranscriber = (
  audio: Float32Array,
  options: SpeechTranscriberOptions,
) => Promise<{ text: string }>

/**
 * Whisper collapses into a repetition loop on short or poor recordings: a
 * six-word note came back as four hundred repeated words. Measured over a
 * labelled Italian corpus these settings removed every loop, taking the
 * aggregate word error rate from 303% to 90%, and nothing else tried came
 * close. Keep them together; they are the brakes, not a tuning preference.
 */
export const TRANSCRIPTION_GUARD = {
  no_repeat_ngram_size: 5,
  repetition_penalty: 1.15,
  temperature: 0,
  condition_on_previous_text: false,
} as const

type ModelProgress = { status?: string; progress?: number }
type ModelProgressListener = (percent?: number) => void
type TranscriberLoader = (
  onProgress: ModelProgressListener,
) => Promise<SpeechTranscriber>

export interface LocalSpeechProviderDependencies {
  decode?: (audio: Blob) => Promise<Float32Array>
  loadTranscriber?: TranscriberLoader
}

/**
 * whisper-base rather than whisper-tiny. Measured over a labelled Italian
 * corpus under the same guard settings, base roughly halved the word error
 * rate: 89.9% to 55.5% overall, and 88% to 48% on clean speech. Male and
 * female voices improved by the same amount, so no per-voice model is
 * warranted. It costs about 73 MB of first-use download against 39 MB, once,
 * and then runs offline from cache.
 */
const MODEL_ID = "onnx-community/whisper-base"

function readFourCharacters(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

function decodeWavePcm(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  if (
    view.byteLength < 44 ||
    readFourCharacters(view, 0) !== "RIFF" ||
    readFourCharacters(view, 8) !== "WAVE"
  ) {
    throw new Error("The browser cannot decode this audio format")
  }

  let channels = 0
  let sampleRate = 0
  let format = 0
  let bitsPerSample = 0
  let dataOffset = 0
  let dataLength = 0

  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const chunk = readFourCharacters(view, offset)
    const length = view.getUint32(offset + 4, true)
    const contentOffset = offset + 8
    if (contentOffset + length > view.byteLength) break
    if (chunk === "fmt " && length >= 16) {
      format = view.getUint16(contentOffset, true)
      channels = view.getUint16(contentOffset + 2, true)
      sampleRate = view.getUint32(contentOffset + 4, true)
      bitsPerSample = view.getUint16(contentOffset + 14, true)
    } else if (chunk === "data") {
      dataOffset = contentOffset
      dataLength = length
    }
    offset = contentOffset + length + (length % 2)
  }

  const bytesPerSample = bitsPerSample / 8
  if (
    !channels ||
    !sampleRate ||
    !dataLength ||
    !Number.isInteger(bytesPerSample) ||
    !(
      (format === 1 && [8, 16, 24, 32].includes(bitsPerSample)) ||
      (format === 3 && bitsPerSample === 32)
    )
  ) {
    throw new Error("The browser cannot decode this WAV encoding")
  }

  const frameSize = channels * bytesPerSample
  const frameCount = Math.floor(dataLength / frameSize)
  if (frameCount === 0) throw new Error("Decoded audio is empty")
  const mono = new Float32Array(frameCount)
  const readSample = (offset: number) => {
    if (format === 3) return view.getFloat32(offset, true)
    if (bitsPerSample === 8) return (view.getUint8(offset) - 128) / 128
    if (bitsPerSample === 16) return view.getInt16(offset, true) / 32_768
    if (bitsPerSample === 24) {
      const unsigned =
        view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16)
      const signed = unsigned & 0x80_00_00 ? unsigned | 0xff_00_00_00 : unsigned
      return signed / 8_388_608
    }
    return view.getInt32(offset, true) / 2_147_483_648
  }

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sample = 0
    for (let channel = 0; channel < channels; channel += 1) {
      sample += readSample(
        dataOffset + frame * frameSize + channel * bytesPerSample,
      )
    }
    mono[frame] = sample / channels
  }

  if (sampleRate === 16_000) return mono
  const resampled = new Float32Array(
    Math.max(1, Math.round((mono.length * 16_000) / sampleRate)),
  )
  for (let index = 0; index < resampled.length; index += 1) {
    const source = (index * sampleRate) / 16_000
    const left = Math.min(Math.floor(source), mono.length - 1)
    const right = Math.min(left + 1, mono.length - 1)
    const mix = source - left
    resampled[index] = mono[left]! * (1 - mix) + mono[right]! * mix
  }
  return resampled
}

async function decodeAudio(audio: Blob) {
  if (audio.size === 0) throw new Error("Cannot transcribe empty audio")

  const audioBuffer = await audio.arrayBuffer()

  const AudioContextConstructor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (
          globalThis as typeof globalThis & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext
  // Playwright's Windows WebKit port has no Web Audio even though Safari does.
  // Keep a standards-free PCM/WAV path so deterministic fixtures and imported
  // recordings still work there; compressed MediaRecorder output uses Web Audio.
  if (!AudioContextConstructor) return decodeWavePcm(audioBuffer)

  const context = new AudioContextConstructor({ sampleRate: 16_000 })
  try {
    const decoded = await context.decodeAudioData(audioBuffer)
    if (decoded.length === 0) throw new Error("Decoded audio is empty")

    const mono = new Float32Array(decoded.length)
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const samples = decoded.getChannelData(channel)
      for (let index = 0; index < decoded.length; index += 1) {
        mono[index] =
          (mono[index] ?? 0) + samples[index]! / decoded.numberOfChannels
      }
    }
    return mono
  } finally {
    await context.close()
  }
}

async function loadWhisperTranscriber(onProgress: ModelProgressListener) {
  const { pipeline } = await import("@huggingface/transformers")
  return (await pipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: "q8",
    progress_callback: (event: ModelProgress) => {
      if (event.status !== "progress_total" && event.status !== "ready") return
      const percent =
        event.status === "progress_total" && typeof event.progress === "number"
          ? Math.max(0, Math.min(100, Math.round(event.progress)))
          : event.status === "ready"
            ? 100
            : undefined
      onProgress(percent)
    },
  })) as SpeechTranscriber
}

/**
 * Creates the local Italian provider behind an injectable boundary. Production
 * shares one instance; tests can supply deterministic decoder/model fixtures.
 */
export function createLocalItalianSpeechProvider(
  dependencies: LocalSpeechProviderDependencies = {},
): SpeechTranscriptionProvider {
  const decode = dependencies.decode ?? decodeAudio
  const loadTranscriber = dependencies.loadTranscriber ?? loadWhisperTranscriber
  const loadListeners = new Set<ModelProgressListener>()
  let transcriber: SpeechTranscriber | undefined
  let transcriberPromise: Promise<SpeechTranscriber> | undefined

  async function getTranscriber(onProgress?: ModelProgressListener) {
    if (transcriber) return transcriber
    if (onProgress) loadListeners.add(onProgress)

    transcriberPromise ??= loadTranscriber((percent) => {
      loadListeners.forEach((listener) => listener(percent))
    })
      .then((loaded) => {
        transcriber = loaded
        return loaded
      })
      .catch((error: unknown) => {
        // A transient download/runtime failure must remain retryable.
        transcriberPromise = undefined
        throw error
      })

    try {
      return await transcriberPromise
    } finally {
      if (onProgress) loadListeners.delete(onProgress)
    }
  }

  async function prepare(options: SpeechTranscriptionOptions = {}) {
    if (!transcriber) options.onProgress?.({ phase: "loading" })
    await getTranscriber((percent) =>
      options.onProgress?.({ phase: "loading", percent }),
    )
  }

  return {
    prepare,
    async transcribeAudio(audio, options = {}) {
      if (audio.size === 0) throw new Error("Cannot transcribe empty audio")

      await prepare(options)
      const engine = await getTranscriber()
      options.onProgress?.({ phase: "processing" })
      const result = await engine(await decode(audio), {
        language: "italian",
        task: "transcribe",
        ...TRANSCRIPTION_GUARD,
      })
      return result.text.trim()
    },
  }
}

export const speechTranscriptionProvider = createLocalItalianSpeechProvider()

export function prepareSpeechTranscription(
  options?: SpeechTranscriptionOptions,
) {
  return speechTranscriptionProvider.prepare(options)
}

export function transcribeAudio(
  audio: Blob,
  options?: SpeechTranscriptionOptions,
) {
  return speechTranscriptionProvider.transcribeAudio(audio, options)
}
