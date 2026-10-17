import {
  Download,
  FileUp,
  LoaderCircle,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { getIsoWeekInfo } from "@/domain/course"
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

export function CourseFiles({ hasCourse }: { hasCourse: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(
    null,
  )
  const [exportError, setExportError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [preview, setPreview] = useState<ArchivePreview | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [replacementConfirmed, setReplacementConfirmed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)

  async function prepareExport() {
    setExporting(true)
    setExportError(null)
    setShareMessage(null)
    setPreparedExport(null)
    try {
      const archive = await exportCourseArchive()
      const file = new File(
        [JSON.stringify(archive, null, 2)],
        archiveFileName(),
        { type: "application/json" },
      )
      setPreparedExport({ file, shareable: supportsFileSharing(file) })
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
      setShareMessage("Il file è pronto. Conservalo in un luogo sicuro.")
    } catch {
      setExportError("Il browser non è riuscito a salvare il file. Riprova.")
    }
  }

  async function shareExport() {
    if (!preparedExport) return
    const fileNavigator = navigator as FileShareNavigator
    if (
      !preparedExport.shareable ||
      typeof fileNavigator.share !== "function" ||
      typeof fileNavigator.canShare !== "function"
    ) {
      setShareMessage(
        "La condivisione di file non è disponibile. Puoi salvare il file.",
      )
      return
    }

    try {
      // Call share during this tap, before awaiting anything, to preserve the
      // browser's user-activation requirement for the native share sheet.
      const sharePromise = fileNavigator.share.call(navigator, {
        files: [preparedExport.file],
      })
      await sharePromise
      setShareMessage("Condivisione completata.")
    } catch (error) {
      setShareMessage(
        typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "AbortError"
          ? "Condivisione annullata. Il file è ancora pronto da salvare."
          : "Condivisione non riuscita. Puoi salvare il file.",
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
      <div className="mt-4">
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
              <div className="mt-3">
                <p className="text-sm leading-5" role="status">
                  File pronto. Il nome non contiene dati personali.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-auto min-h-11 whitespace-normal"
                    onClick={downloadExport}
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
                <Button
                  className="mt-2 w-full h-auto min-h-11 whitespace-normal"
                  onClick={() => {
                    setPreparedExport(null)
                    setShareMessage(null)
                  }}
                  variant="secondary"
                >
                  Chiudi il file pronto
                </Button>
              </div>
            )}
            {exportError && (
              <p className="mt-2 text-sm text-[#a2381b]" role="alert">
                {exportError}
              </p>
            )}
            {shareMessage && (
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                {shareMessage}
              </p>
            )}
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
          accept=".json,application/json"
          aria-hidden="true"
          className="sr-only"
          disabled={readingFile || importing}
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
          disabled={readingFile || importing}
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
        {importError && (
          <p className="mt-2 text-sm text-[#a2381b]" role="alert">
            {importError}
          </p>
        )}

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
                disabled={!replacementConfirmed || importing || imported}
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

export function FullReset({ courseLabel }: { courseLabel: string }) {
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [resetting, setResetting] = useState(false)

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
            Cancellare {courseLabel} da questo dispositivo?
          </p>
          <p className="mt-1 text-sm leading-5">
            Se vuoi conservare il corso, esportalo prima. I file già salvati
            fuori dall’app resteranno dove li hai messi.
          </p>
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
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button
              disabled={resetting}
              onClick={() => {
                setConfirming(false)
                setUnderstood(false)
              }}
              variant="secondary"
            >
              Annulla
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal bg-[#b42318] text-white hover:bg-[#9a1f14]"
              disabled={!understood || resetting}
              onClick={() => {
                setResetting(true)
                void resetAllLocalData()
              }}
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
