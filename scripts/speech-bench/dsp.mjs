// Minimal WAV + DSP helpers for building a labelled speech test corpus.

/** G.711 mu-law to linear. Telephone corpora ship as WAV format tag 7. */
function muLawToLinear(byte) {
  const u = ~byte & 0xff
  let t = ((u & 0x0f) << 3) + 0x84
  t <<= (u & 0x70) >> 4
  return (u & 0x80 ? 0x84 - t : t - 0x84) / 32768
}

/** G.711 A-law to linear, for WAV format tag 6. */
function aLawToLinear(byte) {
  let a = byte ^ 0x55
  const sign = a & 0x80
  a &= 0x7f
  const exponent = a >> 4
  const mantissa = a & 0x0f
  let value =
    exponent === 0
      ? (mantissa << 4) + 8
      : ((mantissa << 4) + 0x108) << (exponent - 1)
  return (sign ? -value : value) / 32768
}

export function readWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const tag = (o) =>
    String.fromCharCode(
      view.getUint8(o),
      view.getUint8(o + 1),
      view.getUint8(o + 2),
      view.getUint8(o + 3),
    )
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV")
  let sampleRate = 0,
    channels = 1,
    bits = 16,
    dataOffset = 0,
    dataLength = 0,
    format = 1
  for (let o = 12; o + 8 <= view.byteLength;) {
    const id = tag(o)
    const size = view.getUint32(o + 4, true)
    const body = o + 8
    if (id === "fmt ") {
      format = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bits = view.getUint16(body + 14, true)
    } else if (id === "data") {
      dataOffset = body
      dataLength = size
    }
    o = body + size + (size % 2)
  }
  const bytes = bits / 8
  const frames = Math.floor(dataLength / (channels * bytes))
  const out = new Float32Array(frames)
  for (let f = 0; f < frames; f += 1) {
    let sum = 0
    for (let c = 0; c < channels; c += 1) {
      const p = dataOffset + (f * channels + c) * bytes
      const raw = view.getUint8(p)
      sum +=
        format === 7
          ? muLawToLinear(raw)
          : format === 6
            ? aLawToLinear(raw)
            : bits === 16
              ? view.getInt16(p, true) / 32768
              : raw / 128 - 1
    }
    out[f] = sum / channels
  }
  return { samples: out, sampleRate }
}

export function writeWav(samples, sampleRate) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buffer
}

export function rms(samples) {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / Math.max(1, samples.length))
}

/** Median F0 over voiced frames, by autocorrelation. Used only to label a clip. */
export function estimateF0(samples, sampleRate) {
  const frame = Math.round(0.04 * sampleRate)
  const hop = Math.round(0.02 * sampleRate)
  const minLag = Math.floor(sampleRate / 300)
  const maxLag = Math.floor(sampleRate / 70)
  const global = rms(samples)
  const found = []
  for (let start = 0; start + frame < samples.length; start += hop) {
    const win = samples.subarray(start, start + frame)
    if (rms(win) < global * 0.6) continue
    let bestLag = 0,
      best = 0,
      zero = 0
    for (let i = 0; i < frame; i += 1) zero += win[i] * win[i]
    if (zero <= 0) continue
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0
      for (let i = 0; i + lag < frame; i += 1) sum += win[i] * win[i + lag]
      const norm = sum / zero
      if (norm > best) {
        best = norm
        bestLag = lag
      }
    }
    if (best > 0.35 && bestLag > 0) found.push(sampleRate / bestLag)
  }
  if (found.length < 5) return null
  found.sort((a, b) => a - b)
  return found[Math.floor(found.length / 2)]
}

function whiteNoise(n) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i += 1) out[i] = Math.random() * 2 - 1
  return out
}

/** Pink: white through a one-pole cascade. Brown: integrated white (wind-like). */
function coloured(n, kind) {
  const white = whiteNoise(n)
  const out = new Float32Array(n)
  if (kind === "pink") {
    let b0 = 0,
      b1 = 0,
      b2 = 0
    for (let i = 0; i < n; i += 1) {
      b0 = 0.99765 * b0 + white[i] * 0.099046
      b1 = 0.963 * b1 + white[i] * 0.2965164
      b2 = 0.57 * b2 + white[i] * 1.0526913
      out[i] = (b0 + b1 + b2 + white[i] * 0.1848) * 0.2
    }
  } else {
    let last = 0
    for (let i = 0; i < n; i += 1) {
      last = (last + 0.02 * white[i]) / 1.02
      out[i] = last * 8
    }
  }
  return out
}

/** Slow gusts over brown noise: the wind a boat crew actually records into. */
function windNoise(n, sampleRate) {
  const base = coloured(n, "brown")
  const out = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate
    const gust =
      0.55 +
      0.45 *
        Math.sin(2 * Math.PI * 0.23 * t + 1.1) *
        Math.sin(2 * Math.PI * 0.07 * t)
    out[i] = base[i] * gust
  }
  return out
}

/** Overlapping speech from other clips. */
function babbleNoise(n, pool) {
  const out = new Float32Array(n)
  for (const voice of pool) {
    const offset = Math.floor(Math.random() * Math.max(1, voice.length - 1))
    for (let i = 0; i < n; i += 1) out[i] += voice[(offset + i) % voice.length]
  }
  return out
}

export function makeNoise(kind, n, sampleRate, pool) {
  if (kind === "white") return whiteNoise(n)
  if (kind === "pink") return coloured(n, "pink")
  if (kind === "wind") return windNoise(n, sampleRate)
  if (kind === "babble") return babbleNoise(n, pool)
  throw new Error(`unknown noise ${kind}`)
}

export function mixAtSnr(speech, noise, snrDb) {
  const speechRms = rms(speech)
  const noiseRms = rms(noise) || 1e-9
  const target = speechRms / Math.pow(10, snrDb / 20)
  const gain = target / noiseRms
  const out = new Float32Array(speech.length)
  for (let i = 0; i < speech.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, speech[i] + noise[i] * gain))
  }
  return out
}

export function applyGain(samples, gain) {
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain))
  }
  return out
}
