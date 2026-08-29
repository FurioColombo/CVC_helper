export interface SpeechTranscriptionProvider {
  transcribeAudio(audio: Blob): Promise<string>
}

type WhisperTranscriber = (
  audio: Float32Array,
  options: { language: "italian"; task: "transcribe" },
) => Promise<{ text: string }>

const MODEL_ID = "onnx-community/whisper-tiny"
let transcriberPromise: Promise<WhisperTranscriber> | undefined

async function decodeAudio(audio: Blob) {
  const context = new AudioContext({ sampleRate: 16_000 })
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer())
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

async function getTranscriber() {
  transcriberPromise ??= import("@huggingface/transformers").then(
    async ({ pipeline }) =>
      (await pipeline("automatic-speech-recognition", MODEL_ID, {
        dtype: "q8",
      })) as WhisperTranscriber,
  )
  return transcriberPromise
}

class LocalItalianWhisperProvider implements SpeechTranscriptionProvider {
  async transcribeAudio(audio: Blob) {
    const transcriber = await getTranscriber()
    const result = await transcriber(await decodeAudio(audio), {
      language: "italian",
      task: "transcribe",
    })
    return result.text.trim()
  }
}

export const speechTranscriptionProvider = new LocalItalianWhisperProvider()

export function transcribeAudio(audio: Blob) {
  return speechTranscriptionProvider.transcribeAudio(audio)
}
