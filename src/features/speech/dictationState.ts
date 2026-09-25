import type { useDictation } from "@/features/speech/useDictation"

export type Dictation = ReturnType<typeof useDictation>

/**
 * Accessible naming for one dictation surface. `start` is the whole name of
 * the start button, because each screen says what it is dictating in its own
 * words. `subject` completes the sentence the remaining controls share, so
 * "avaria" gives "Termina dettatura avaria" and "di Bea" gives "Termina
 * dettatura di Bea".
 */
export interface DictationNaming {
  start: string
  subject: string
}

const BUSY_STATUSES = new Set(["permission", "loading", "processing"])

/** True while the microphone or the model is occupied and cannot be asked again. */
export function isDictationBusy(dictation: Pick<Dictation, "status">) {
  return BUSY_STATUSES.has(dictation.status)
}

/** True while the microphone or model is active, so a form must wait. */
export function isDictationPending(dictation: Pick<Dictation, "status">) {
  return isDictationBusy(dictation) || dictation.status === "recording"
}

export function dictationProgressSuffix(dictation: Dictation) {
  return dictation.status === "loading" && dictation.loadPercent !== undefined
    ? ` ${dictation.loadPercent}%`
    : ""
}
