import {
  CircleCheck,
  Download,
  FileUp,
  LoaderCircle,
  Share2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"

import { eraseOnlineCopyBeforeReset } from "@/backup/session"
import { useBackupState } from "@/backup/useBackupState"
import { Button } from "@/components/ui/button"
import { getIsoWeekInfo } from "@/domain/course"
import { deviceSyncMode } from "@/persistence/backupLink"
import {
  exportCourseArchive,
  importCourseArchive,
} from "@/persistence/courseArchive"
import {
  archiveSummary,
  CourseArchiveError,
  parseCourseArchive,
  type CourseArchive,
} from "@/persistence/courseArchiveFormat"
import {
  persistentStorageStatus,
  type PersistentStorageStatus,
} from "@/persistence/browserStorage"
import {
  announceCourseReplacement,
  resetAllLocalData,
} from "@/persistence/localDataOperations"

type PreparedExport = {
  file: File
  shareFile: File
  shareable: boolean
}

type ArchivePreview = {
  archive: CourseArchive
  label: string
  students: number
  volunteers: number
  boats: number
}

type FileShareNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean
  share?: (data?: ShareData) => Promise<void>
}

function archiveFileName(date = new Date()): string {
  const { year, isoWeek } = getIsoWeekInfo(date)
  return `cvc-helper-corso-${year}-W${String(isoWeek).padStart(2, "0")}.json`
}

/**
 * Chrome on Android shares only allow-listed file types, and JSON is not one:
 * sharing the .json file fails (owner phone check, 2026-10-19). The shared
 * copy is the same text as plain text; import accepts both names.
 */
function shareCopy(file: File, text: string): File {
  return new File([text], file.name.replace(/\.json$/, ".txt"), {
    type: "text/plain",
  })
}

/** Rulebook R06/R14: an error carries the warning triangle, not colour alone. */
function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-2 flex items-start gap-2 text-sm leading-5 font-semibold text-[#a2381b]"
      role="alert"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-[#b42318]"
      />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** Bring new feedback fully into view, clear of the fixed bottom bar. */
function reveal(element: HTMLElement | null) {
  element?.scrollIntoView?.({ block: "nearest" })
}

function supportsFileSharing(file: File): boolean {
  if (typeof navigator === "undefined") return false
  const fileNavigator = navigator as FileShareNavigator
  if (
    typeof fileNavigator.share !== "function" ||
    typeof fileNavigator.canShare !== "function"
  ) {
    return false
  }
  try {
    return fileNavigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function CourseFiles({
  hasCourse,
  importBlocked = false,
}: {
  hasCourse: boolean
  /**
   * B5: the account's course may still be on its way to this switched,
   * empty device; an imported one would make two (review DI-B5-1).
   */
  importBlocked?: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(
    null,
  )
  const [exportError, setExportError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const preparedBlock = useRef<HTMLDivElement>(null)
  const exportFeedback = useRef<HTMLDivElement>(null)
  // Counts taps that produce feedback, so a repeated identical message is
  // revealed again (FU-R7-Q2).
  const [feedbackTap, setFeedbackTap] = useState(0)
  const importFeedback = useRef<HTMLDivElement>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [preview, setPreview] = useState<ArchivePreview | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [replacementConfirmed, setReplacementConfirmed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)

  // The prepared file replaces the button that was tapped; focus follows it
  // so the second step is unmistakable (owner phone check, 2026-10-19). The
  // whole block, status included, is revealed instead of letting the focus
  // scroll centre the button and push the status off screen (FU-R6-I1).
  useEffect(() => {
    if (!preparedExport) return
    saveButton.current?.focus({ preventScroll: true })
    reveal(preparedBlock.current)
  }, [preparedExport])

  // Each result of Salva file, Condividi or preparation lands below the
  // buttons, where the bottom bar could hide it (FU-R6-B1).
  useEffect(() => {
    if (exportError || shareError || shareMessage)
      reveal(exportFeedback.current)
  }, [exportError, shareError, shareMessage, feedbackTap])

  useEffect(() => {
    if (importError) reveal(importFeedback.current)
  }, [importError])

  async function prepareExport() {
    setExporting(true)
    setExportError(null)
    setShareMessage(null)
    setShareError(null)
    setPreparedExport(null)
    try {
      const archive = await exportCourseArchive()
      const text = JSON.stringify(archive, null, 2)
      const file = new File([text], archiveFileName(), {
        type: "application/json",
      })
      const shareFile = shareCopy(file, text)
      setPreparedExport({
        file,
        shareFile,
        shareable: supportsFileSharing(shareFile),
      })
    } catch {
      setExportError(
        "Non è stato possibile preparare il file. Il corso non è stato modificato; riprova.",
      )
    } finally {
      setExporting(false)
    }
  }

  function downloadExport() {
    if (!preparedExport) return
    setFeedbackTap((count) => count + 1)
    let url: string
    try {
      url = URL.createObjectURL(preparedExport.file)
      const link = document.createElement("a")
      link.href = url
      link.download = preparedExport.file.name
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setShareError(null)
      setShareMessage(
        "Salvataggio avviato. Conserva il file in un luogo sicuro.",
      )
    } catch {
      setExportError("Il browser non è riuscito a salvare il file. Riprova.")
    }
  }

  async function shareExport() {
    if (!preparedExport) return
    const fileNavigator = navigator as FileShareNavigator
    setFeedbackTap((count) => count + 1)
    setShareMessage(null)
    setShareError(null)
    if (
      !preparedExport.shareable ||
      typeof fileNavigator.share !== "function" ||
      typeof fileNavigator.canShare !== "function"
    ) {
      setShareError(
        "La condivisione di file non è disponibile. Puoi salvare il file.",
      )
      return
    }

    try {
      // Call share during this tap, before awaiting anything, to preserve the
      // browser's user-activation requirement for the native share sheet.
      const sharePromise = fileNavigator.share.call(navigator, {
        files: [preparedExport.shareFile],
      })
      await sharePromise
      setShareMessage("Condivisione completata.")
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      )
        setShareMessage(
          "Condivisione annullata. Il file è ancora pronto da salvare.",
        )
      else
        setShareError(
          "Condivisione non riuscita. Puoi salvare il file con Salva file.",
        )
    }
  }

  async function readArchive(file: File | undefined) {
    setPreview(null)
    setReplacementConfirmed(false)
    setImportError(null)
    setImported(false)
    if (!file) return
    setReadingFile(true)
    try {
      const archive = parseCourseArchive(await file.text())
      setPreview({ archive, ...archiveSummary(archive) })
    } catch (error) {
      setImportError(
        error instanceof CourseArchiveError
          ? error.message
          : "Non è stato possibile leggere il file. Nessun dato è stato cambiato.",
      )
    } finally {
      setReadingFile(false)
    }
  }

  async function replaceCourse() {
    if (!preview || !replacementConfirmed || importing) return
    setImporting(true)
    setImportError(null)
    try {
      await importCourseArchive(preview.archive)
    } catch (error) {
      setImportError(
        error instanceof CourseArchiveError
          ? error.message
          : "Il corso non è stato sostituito. Nessun dato è cambiato; riprova.",
      )
      setImporting(false)
      return
    }

    announceCourseReplacement()
    setImported(true)
    setImporting(false)
  }

  return (
    <section
      aria-labelledby="course-files-title"
      className="mt-6 border-t pt-5"
    >
      <h2 className="text-base font-bold text-primary" id="course-files-title">
        Copia del corso
      </h2>
      <div className={hasCourse ? "mt-4" : "hidden"}>
        <h3 className="text-sm font-bold">Esporta</h3>
        {hasCourse ? (
          <>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Il file contiene i dati personali degli allievi e tutte le
              informazioni del corso. Conservalo e condividilo solo con persone
              autorizzate.
            </p>
            {!preparedExport ? (
              <Button
                className="mt-3 w-full h-auto min-h-11 whitespace-normal"
                disabled={exporting}
                onClick={() => void prepareExport()}
                variant="secondary"
              >
                {exporting ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <Download aria-hidden="true" className="size-4" />
                )}
                {exporting ? "Preparazione…" : "Prepara il file del corso"}
              </Button>
            ) : (
              <div className="mt-3" data-reveal ref={preparedBlock}>
                <p
                  className="flex items-start gap-2 text-sm leading-5 font-semibold text-primary"
                  id="prepared-file-status"
                  role="status"
                >
                  <CircleCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    File del corso pronto: ora salvalo o condividilo. Il nome
                    non contiene dati personali.
                  </span>
                </p>
                {preparedExport.shareable && (
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">
                    Condividi invia lo stesso corso come file .txt: si importa
                    come il file salvato.
                  </p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Button
                    aria-describedby="prepared-file-status"
                    className="h-auto min-h-11 whitespace-normal"
                    onClick={downloadExport}
                    ref={saveButton}
                    variant="secondary"
                  >
                    <Download aria-hidden="true" className="size-4 shrink-0" />
                    Salva file
                  </Button>
                  {preparedExport.shareable && (
                    <Button
                      className="h-auto min-h-11 whitespace-normal"
                      onClick={() => void shareExport()}
                      variant="secondary"
                    >
                      <Share2 aria-hidden="true" className="size-4 shrink-0" />
                      Condividi
                    </Button>
                  )}
                </div>
                {!preparedExport.shareable && (
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">
                    La condivisione di file non è disponibile in questo browser.
                    Puoi salvare il file.
                  </p>
                )}
              </div>
            )}
            <div data-reveal ref={exportFeedback}>
              {exportError && <ErrorNotice>{exportError}</ErrorNotice>}
              {shareError && <ErrorNotice>{shareError}</ErrorNotice>}
              {shareMessage && (
                <p className="mt-2 text-sm text-muted-foreground" role="status">
                  {shareMessage}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Crea un corso per poter preparare un archivio.
          </p>
        )}
      </div>

      <div className="mt-5 border-t pt-4">
        <h3 className="text-sm font-bold">Importa un corso</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Scegli un archivio CVC Helper. L’app ne controlla formato e dati prima
          di chiederti conferma.
        </p>
        <input
          accept=".json,.txt,application/json,text/plain"
          aria-hidden="true"
          className="sr-only"
          disabled={readingFile || importing || importBlocked}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            void readArchive(file)
          }}
          ref={fileInput}
          tabIndex={-1}
          type="file"
        />
        <Button
          className="mt-3 w-full h-auto min-h-11 whitespace-normal"
          disabled={readingFile || importing || importBlocked}
          onClick={() => fileInput.current?.click()}
          variant="secondary"
        >
          {readingFile ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FileUp aria-hidden="true" className="size-4" />
          )}
          {readingFile ? "Controllo del file…" : "Scegli il file del corso"}
        </Button>
        <div data-reveal ref={importFeedback}>
          {importError && <ErrorNotice>{importError}</ErrorNotice>}
        </div>

        {preview && (
          <div
            className="mt-3 border-l-4 border-primary pl-3"
            aria-labelledby="archive-preview-title"
          >
            <h4 className="text-sm font-bold" id="archive-preview-title">
              Corso trovato
            </h4>
            <p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">
              {preview.label}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {preview.students} allievi · {preview.volunteers} volontari ·{" "}
              {preview.boats} barche
            </p>
            <p className="mt-2 text-sm leading-5">
              {hasCourse
                ? "Importare sostituisce tutti i dati del corso attuale. I corsi non vengono uniti."
                : "Importare aggiunge questo corso al dispositivo. L’archivio non viene unito ad altri dati."}
            </p>
            <p className="mt-2 text-sm leading-5">
              Prima di importare chiudi le altre schede dell’app, soprattutto
              quelle di una vecchia versione.
            </p>
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                checked={replacementConfirmed}
                className="size-5 shrink-0 accent-primary"
                disabled={importing || imported}
                onChange={(event) =>
                  setReplacementConfirmed(event.target.checked)
                }
                type="checkbox"
              />
              {hasCourse
                ? "Ho capito: il corso attuale sarà sostituito"
                : "Confermo di importare questo corso sul dispositivo"}
            </label>
            {imported && (
              <p
                className="mt-2 text-sm font-semibold text-primary"
                role="status"
              >
                Corso importato. L’app sta caricando i nuovi dati.
              </p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Button
                disabled={importing || imported}
                onClick={() => {
                  setPreview(null)
                  setReplacementConfirmed(false)
                  setImportError(null)
                }}
                variant="secondary"
              >
                Annulla
              </Button>
              <Button
                className="h-auto min-h-11 whitespace-normal"
                disabled={
                  !replacementConfirmed ||
                  importing ||
                  imported ||
                  importBlocked
                }
                onClick={() => void replaceCourse()}
              >
                {importing && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                {importing
                  ? "Importazione…"
                  : hasCourse
                    ? "Sostituisci il corso"
                    : "Importa il corso"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function StorageStatus() {
  const [status, setStatus] = useState<PersistentStorageStatus | "loading">(
    "loading",
  )

  useEffect(() => {
    let active = true
    void persistentStorageStatus()
      .then((result) => {
        if (active) setStatus(result)
      })
      .catch(() => {
        if (active) setStatus("denied")
      })
    return () => {
      active = false
    }
  }, [])

  const message = {
    loading: "Verifica della protezione dei dati…",
    granted:
      "Il browser ha accettato di conservare i dati dell’app anche quando lo spazio è ridotto.",
    denied:
      "Il browser non garantisce la conservazione dei dati quando lo spazio è ridotto. Esporta il corso con regolarità.",
    unsupported:
      "Questo browser non può attivare la conservazione dei dati. Esporta il corso con regolarità.",
  }[status]

  return (
    <section
      aria-labelledby="storage-status-title"
      className="mt-6 border-t pt-5"
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold text-primary"
        id="storage-status-title"
      >
        <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
        Conservazione dei dati
      </h2>
      <p
        aria-live="polite"
        className="mt-1 text-sm leading-5 text-muted-foreground"
        role="status"
      >
        {message}
      </p>
    </section>
  )
}

/** `courseLabel` is the course's visible identity, or null with no course. */
export function FullReset({
  courseLabel,
  eraseOnline = eraseOnlineCopyBeforeReset,
}: {
  courseLabel: string | null
  eraseOnline?: () => Promise<string | null>
}) {
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const backup = useBackupState()
  const signedIn =
    backup.kind === "connected" ||
    backup.kind === "offline" ||
    backup.kind === "restoring"
  const [synced, setSynced] = useState(false)
  useEffect(() => {
    let current = true
    void deviceSyncMode()
      .then((mode) => {
        if (current) setSynced(mode === "synced")
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [])

  async function reset() {
    setResetting(true)
    setOnlineError(null)
    // B6: signed in, the course goes from the backup first; a failure
    // resets nothing.
    const refused = await eraseOnline().catch(
      () => "Il corso non è stato eliminato dal backup online: riprova.",
    )
    if (refused) {
      setOnlineError(refused)
      setResetting(false)
      return
    }
    void resetAllLocalData()
  }

  return (
    <section
      aria-labelledby="full-reset-title"
      className="mt-6 border-t border-[#efc1b2] pt-5"
    >
      <h2 className="text-base font-bold text-[#a2381b]" id="full-reset-title">
        Azzera i dati di questo dispositivo
      </h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        Elimina corso, preferenze locali e file offline dell’app salvati in
        questo browser. È un’operazione definitiva.
        {courseLabel &&
          " Per iniziare il prossimo corso basta Nuovo corso, qui sopra."}
      </p>
      {!confirming ? (
        <Button
          className="mt-3 w-full h-auto min-h-11 whitespace-normal text-[#a2381b]"
          onClick={() => setConfirming(true)}
          variant="secondary"
        >
          <Trash2 aria-hidden="true" className="size-4 shrink-0" />
          Azzera tutti i dati locali
        </Button>
      ) : (
        <div
          className="mt-3 border-l-4 border-[#b42318] bg-[#fff4ee] p-3"
          role="group"
          aria-labelledby="full-reset-question"
        >
          <p className="text-sm font-bold" id="full-reset-question">
            {courseLabel
              ? `Cancellare ${courseLabel} da questo dispositivo?`
              : "Cancellare preferenze e file offline da questo dispositivo?"}
          </p>
          <p className="mt-1 text-sm leading-5">
            {courseLabel
              ? "Se vuoi conservare il corso, esportalo prima. I file già salvati fuori dall’app resteranno dove li hai messi."
              : "Non c’è un corso da cancellare: restano solo preferenze e file offline."}{" "}
            Dopo l’azzeramento, per riaprire l’app serve una connessione.
          </p>
          {synced && (
            <p className="mt-1 text-sm leading-5">
              {signedIn
                ? "Il corso sarà eliminato anche dal backup online: senza connessione non si azzera nulla."
                : "La copia nel backup online resta: per eliminarla accedi al backup ed elimina il corso."}
            </p>
          )}
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input
              checked={understood}
              className="size-5 shrink-0 accent-[#b42318]"
              disabled={resetting}
              onChange={(event) => setUnderstood(event.target.checked)}
              type="checkbox"
            />
            Ho capito: corso, preferenze e file offline saranno cancellati
          </label>
          {onlineError && (
            <p
              className="mt-2 text-sm font-semibold text-[#a2381b]"
              role="alert"
            >
              {onlineError}
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button
              disabled={resetting}
              onClick={() => {
                setConfirming(false)
                setUnderstood(false)
                setOnlineError(null)
              }}
              variant="secondary"
            >
              Annulla
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal bg-[#b42318] text-white hover:bg-[#9a1f14]"
              disabled={!understood || resetting}
              onClick={() => void reset()}
            >
              {resetting && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              {resetting ? "Azzeramento…" : "Azzera i dati"}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
