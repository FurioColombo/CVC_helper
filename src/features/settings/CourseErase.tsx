import { LoaderCircle, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { CourseIdentity } from "@/components/CourseIdentity"
import { ERASURE_RETENTION_TEXT } from "@/backup/erasure"
import { reconnectBackup } from "@/backup/session"
import { useBackupState } from "@/backup/useBackupState"
import { Button } from "@/components/ui/button"
import { deviceSyncMode } from "@/persistence/backupLink"
import { eraseAllCourseData, type CourseRecord } from "@/persistence/courses"

/**
 * The only way to start the next course: the app keeps one course, so the
 * current one and everything recorded in it is erased from this device first.
 * The confirmation names the course and asks for an explicit acknowledgement,
 * because nothing can bring the data back.
 */
export function CourseErase({
  course,
  onErased,
  erase = eraseAllCourseData,
}: {
  course: CourseRecord
  onErased: () => void
  erase?: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [failed, setFailed] = useState(false)
  // B6: a synced device erases the course from the backup too; signed out,
  // only at the next sign-in on this device (review SP-B6-2).
  const backup = useBackupState()
  const signedIn =
    backup.kind === "connected" ||
    backup.kind === "offline" ||
    backup.kind === "restoring" ||
    backup.kind === "error"
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

  async function eraseCourse() {
    setErasing(true)
    setFailed(false)
    try {
      await erase()
    } catch {
      setErasing(false)
      setFailed(true)
      void reconnectBackup().catch(() => {})
      return
    }
    onErased()
  }

  return (
    <section
      aria-labelledby="course-erase-title"
      className="mt-6 rounded-2xl border bg-card p-4 max-[350px]:p-[12px]"
    >
      <h2 className="text-sm font-bold text-primary" id="course-erase-title">
        Nuovo corso
      </h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        Per iniziare un nuovo corso elimina da questo dispositivo tutti i dati
        del corso attuale.
      </p>
      {!confirming ? (
        <Button
          className="mt-3 h-auto min-h-11 w-full whitespace-normal text-[#b42318]"
          onClick={() => setConfirming(true)}
          variant="secondary"
        >
          <Trash2 aria-hidden="true" className="size-4 shrink-0" />
          Elimina il corso e inizia un nuovo corso
        </Button>
      ) : (
        <div
          aria-labelledby="course-erase-question"
          className="mt-3 rounded-xl border border-[#f0b69f] bg-[#fff4ee] p-3"
          role="group"
        >
          <p className="text-sm font-bold" id="course-erase-question">
            Eliminare definitivamente il corso{" "}
            <span className="inline-flex align-middle">
              <CourseIdentity {...course} size="compact" />
            </span>
            ?
          </p>
          <p className="mt-1 text-sm leading-5">
            Allievi, barche, avarie, volontari, comandate, equipaggi e
            valutazioni vengono cancellati da questo dispositivo
            {synced &&
              (signedIn
                ? " e dal backup online, appena c’è connessione,"
                : " e dal backup online quando rientri con questo account da questo telefono,")}{" "}
            e non si possono recuperare.
          </p>
          {synced && (
            <p className="mt-1 text-sm leading-5">{ERASURE_RETENTION_TEXT}</p>
          )}
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              checked={understood}
              className="size-5 shrink-0 accent-[#b42318]"
              disabled={erasing}
              onChange={(event) => setUnderstood(event.target.checked)}
              type="checkbox"
            />
            Ho capito: i dati non si possono recuperare
          </label>
          {failed && (
            <p
              className="mt-2 text-sm font-semibold text-[#a2381b]"
              role="alert"
            >
              Il corso non è stato eliminato. Nessun dato è cambiato: riprova.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              disabled={erasing}
              onClick={() => {
                setConfirming(false)
                setUnderstood(false)
                setFailed(false)
              }}
              variant="secondary"
            >
              Annulla
            </Button>
            <Button
              className="bg-[#b42318] text-white hover:bg-[#9a1f14]"
              disabled={!understood || erasing}
              onClick={() => void eraseCourse()}
            >
              {erasing && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              {erasing ? "Eliminazione…" : "Elimina tutto"}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
