/**
 * The first dictation tap downloads the Whisper model (about 73 MB from the
 * Hugging Face CDN) before the app asks for the microphone, so a test that
 * denies the microphone sees its alert only after that download. On a slow
 * line it takes over a minute (about 1.1 MB/s was measured on 2026-10-07, when
 * a 30 s wait failed three journeys on an unchanged app); later taps in the
 * same page reuse the cached model and answer at once.
 */
export const FIRST_DICTATION_TIMEOUT = 180_000

/** A whole journey that starts with one such download. */
export const DICTATION_JOURNEY_TIMEOUT = 300_000
