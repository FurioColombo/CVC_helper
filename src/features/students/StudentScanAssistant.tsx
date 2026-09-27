/**
 * The assistant path of Scan allievi (V05): the idle-screen section that
 * copies the roster-paste prompt and reads back a pasted answer, and the
 * review-screen section that lets the operator fix a line the answer got
 * wrong without losing the rest of the import.
 *
 * The app never talks to an assistant itself. This file only ever copies text
 * to the clipboard and parses text the operator pastes back in; it makes no
 * network call and must never grow one.
 */
import { ChevronDown, Copy } from "lucide-react"
import { useState } from "react"

import {
  parseRosterPaste,
  parseRosterPasteRow,
  ROSTER_PASTE_HEADER,
  ROSTER_PASTE_MAX_ROWS,
  rosterPastePrompt,
  type UnparsedPasteLine,
} from "@/capabilities/rosterPaste"
import type { StudentScanCandidate } from "@/capabilities/studentScan"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface RosterPasteImportResult {
  candidates: StudentScanCandidate[]
  unparsed: UnparsedPasteLine[]
  complete: boolean
}

const TEXTAREA_CLASS =
  "w-full rounded-xl border bg-card p-3 text-base outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * The idle-screen entry point, collapsed by default: a short privacy note,
 * the prompt to copy, and the field to read the assistant's answer back.
 *
 * `expanded` and `answer` are owned by the review screen rather than by this
 * component, so a discarded review can hand the operator back to exactly the
 * text they pasted (V05 review V5-6): this section itself keeps no memory of
 * its own that would otherwise be lost the moment an import replaces it.
 */
export function StudentScanAssistantSection({
  answer,
  courseStartDate,
  expanded,
  onAnswerChange,
  onExpandedChange,
  onImport,
  readPhone,
}: {
  answer: string
  courseStartDate: string
  expanded: boolean
  onAnswerChange: (answer: string) => void
  onExpandedChange: (expanded: boolean) => void
  onImport: (result: RosterPasteImportResult) => void
  readPhone: boolean
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  )
  // A generic "wrong format" is not enough to fix a real answer: the operator
  // needs the header this app actually expects and, when the parser found no
  // header at all, what it made of the lines it read instead (V05 review
  // V5R2-7). A runaway answer is a different problem with its own message
  // (tooLong) and no per-line detail to show.
  const [readError, setReadError] = useState<
    | { kind: "format-missing"; lines: UnparsedPasteLine[] }
    | { kind: "too-long" }
    | null
  >(null)
  const prompt = rosterPastePrompt({ readPhone })

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard non disponibile")
      }
      await navigator.clipboard.writeText(prompt)
      setCopyState("copied")
    } catch {
      // The prompt must never be lost: if the clipboard is unavailable or the
      // write fails, it stays on screen, selectable, instead.
      setCopyState("failed")
    }
  }

  function readAnswer() {
    const result = parseRosterPaste(answer, { courseStartDate, readPhone })
    if (result.tooLong) {
      setReadError({ kind: "too-long" })
      return
    }
    if (result.formatMissing) {
      setReadError({ kind: "format-missing", lines: result.unparsed })
      return
    }
    setReadError(null)
    onImport(result)
  }

  return (
    <section className="mt-4 rounded-2xl border bg-card p-3 text-left">
      <button
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        onClick={() => onExpandedChange(!expanded)}
        type="button"
      >
        Oppure usa un assistente
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* `grid-cols-1` rather than a bare `grid`, as in the review screen
          below: the implicit column otherwise sizes to its widest child's
          max-content and can push the page sideways at 320px/200% text. */}
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            La foto contiene dati personali degli allievi, compresi eventuali
            minorenni: inviala solo a un assistente autorizzato dal centro
            velico. L’app non invia nulla da sola.
          </p>

          <div className="grid grid-cols-1 gap-2">
            <Button
              className="min-h-11 w-full"
              onClick={() => void copyPrompt()}
              type="button"
              variant="secondary"
            >
              <Copy aria-hidden="true" className="size-4" />
              {copyState === "copied" ? "Copiate" : "Copia istruzioni"}
            </Button>
            {copyState === "failed" && (
              <label className="grid min-w-0 gap-1.5 text-xs font-bold">
                Non sono riuscito a copiare: seleziona e copia il testo qui
                sotto
                <textarea
                  className={`${TEXTAREA_CLASS} min-h-24 text-xs`}
                  onFocus={(event) => event.target.select()}
                  readOnly
                  value={prompt}
                />
              </label>
            )}
          </div>

          <label className="grid min-w-0 gap-1.5 text-sm font-bold">
            Risposta dell’assistente
            <textarea
              className={`${TEXTAREA_CLASS} min-h-32`}
              onChange={(event) => {
                onAnswerChange(event.target.value)
                setReadError(null)
              }}
              value={answer}
            />
          </label>

          {readError?.kind === "format-missing" && (
            <div role="alert">
              <p className="text-xs font-semibold text-[#b42318]">
                La risposta non è nel formato richiesto: deve iniziare con
                l’intestazione «{ROSTER_PASTE_HEADER}». Copia di nuovo le
                istruzioni, incolla la risposta dell’assistente senza
                modificarla e riprova.
              </p>
              {readError.lines.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-xs leading-5 text-[#b42318]">
                  {readError.lines.slice(0, 5).map((line) => (
                    <li key={line.line}>
                      Riga {line.line}: {line.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {readError?.kind === "too-long" && (
            <p className="text-xs font-semibold text-[#b42318]" role="alert">
              Risposta troppo lunga: più di {ROSTER_PASTE_MAX_ROWS} righe.
              Controlla l’assistente e incolla di nuovo.
            </p>
          )}

          <Button
            className="min-h-11 w-full"
            disabled={!answer.trim()}
            onClick={readAnswer}
            type="button"
          >
            Leggi risposta
          </Button>
        </div>
      )}
    </section>
  )
}

function UnparsedLineRow({
  courseStartDate,
  disabled,
  line,
  onLeaveOut,
  onRegisterInput,
  onResolved,
  readPhone,
}: {
  courseStartDate: string
  disabled: boolean
  line: UnparsedPasteLine
  onLeaveOut: (line: UnparsedPasteLine) => void
  onRegisterInput: (line: number, node: HTMLElement | null) => void
  onResolved: (line: UnparsedPasteLine, candidate: StudentScanCandidate) => void
  readPhone: boolean
}) {
  const [text, setText] = useState(line.text)
  const [reason, setReason] = useState(line.reason)

  function reread() {
    const result = parseRosterPasteRow(text, line.line, {
      courseStartDate,
      readPhone,
    })
    if (result.ok) onResolved(line, result.candidate)
    else setReason(result.reason)
  }

  return (
    <div className="rounded-xl border bg-muted/40 p-2.5">
      <p className="text-xs font-bold text-muted-foreground">
        Riga {line.line}
      </p>
      <Input
        aria-label={`Testo riga ${line.line}`}
        className="mt-1"
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        // Enter here is the phone keyboard's own "Vai"/"Invio" key finishing
        // a correction, not a request to save the whole roster: left alone,
        // the browser's implicit form submission would run commitCandidates
        // and silently drop every other unread line (V05 review V5-1).
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          reread()
        }}
        ref={(node: HTMLInputElement | null) =>
          onRegisterInput(line.line, node)
        }
        value={text}
      />
      <p className="mt-1.5 text-xs font-semibold text-[#a2381b]">{reason}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          className="min-h-10 px-2.5 text-xs"
          disabled={disabled || !text.trim()}
          onClick={reread}
          type="button"
          variant="secondary"
        >
          Rileggi riga
        </Button>
        <Button
          className="min-h-10 px-2.5 text-xs"
          disabled={disabled}
          onClick={() => onLeaveOut(line)}
          type="button"
          variant="secondary"
        >
          Lascia fuori
        </Button>
      </div>
    </div>
  )
}

/**
 * The review screen's extra section for a pasted answer: a completeness
 * confirmation the operator must give for every answer, not only an
 * interrupted one (V05 review V5R2-3), the lines the parser could not read,
 * each fixable in place or explicitly left out, and a way back to exactly
 * what was pasted. The way back is always rendered, even with nothing left
 * unread (V05 review V5R2-5): the pasted text itself is still one tap away
 * for as long as this paste review is open.
 */
export function StudentScanUnparsedLines({
  complete,
  countConfirmed,
  courseStartDate,
  disabled,
  lines,
  onConfirmComplete,
  onLeaveOut,
  onRegisterConfirmation,
  onRegisterInput,
  onResolved,
  onReturnToAnswer,
  readCount,
  readPhone,
}: {
  complete: boolean
  /** The operator has confirmed the sheet has no more students than were
   * read (V05 review V5R2-3): required before saving, for every pasted
   * answer, not only an interrupted one. Covers today's exact row count
   * (V05 review V5F-1): the caller recomputes it from scratch whenever an
   * unread line or a candidate row changes, so this is never left standing
   * for a count that no longer matches what is on screen. */
  countConfirmed: boolean
  courseStartDate: string
  disabled: boolean
  lines: UnparsedPasteLine[]
  onConfirmComplete: () => void
  onLeaveOut: (line: UnparsedPasteLine) => void
  onRegisterConfirmation: (node: HTMLElement | null) => void
  onRegisterInput: (line: number, node: HTMLElement | null) => void
  onResolved: (line: UnparsedPasteLine, candidate: StudentScanCandidate) => void
  onReturnToAnswer: () => void
  /** Students currently read from the answer (candidate rows on screen),
   * shown so the operator can compare it against the sheet rather than
   * count blind. */
  readCount: number
  readPhone: boolean
}) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          className="min-h-10 px-2.5 text-xs"
          disabled={disabled}
          onClick={onReturnToAnswer}
          type="button"
          variant="secondary"
        >
          Torna alla risposta
        </Button>
      </div>
      {!countConfirmed && (
        <section
          className="mb-3 rounded-2xl border border-[#f79009] bg-[#fff9ef] p-3"
          role="alert"
        >
          <p className="text-xs leading-5 font-semibold text-[#9a3412]">
            {!complete && "La risposta sembra interrotta: manca la riga FINE. "}
            Letti {readCount} {readCount === 1 ? "allievo" : "allievi"} dalla
            risposta: sono tutti quelli del foglio?
          </p>
          <Button
            className="mt-2 min-h-10 px-2.5 text-xs"
            disabled={disabled || lines.length > 0}
            onClick={onConfirmComplete}
            ref={(node: HTMLButtonElement | null) =>
              onRegisterConfirmation(node)
            }
            type="button"
            variant="secondary"
          >
            Sono tutti
          </Button>
          {lines.length > 0 && (
            // A count given while a line is still unread would cover a
            // number that is about to change (V05 review V5F-1): the button
            // above is disabled for exactly that reason, and this says why.
            <p className="mt-1.5 text-xs leading-5 text-[#9a3412]">
              Prima decidi le righe non lette.
            </p>
          )}
        </section>
      )}
      {lines.length > 0 && (
        <section
          aria-label={`Righe non lette (${lines.length})`}
          className="mb-3 rounded-2xl border border-[#f79009] bg-card p-3"
        >
          <h2 className="text-sm font-black">
            Righe non lette ({lines.length})
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Correggi il testo e rileggi la riga, oppure lascia l’allievo fuori
            dall’elenco.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {lines.map((line) => (
              <UnparsedLineRow
                courseStartDate={courseStartDate}
                disabled={disabled}
                key={line.line}
                line={line}
                onLeaveOut={onLeaveOut}
                onRegisterInput={onRegisterInput}
                onResolved={onResolved}
                readPhone={readPhone}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
