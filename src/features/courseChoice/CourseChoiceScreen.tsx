import { LoaderCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { PROVIDER_COPIES_TEXT } from "@/backup/erasure"
import { keepCourse } from "@/backup/session"
import { useBackupState } from "@/backup/useBackupState"
import { CourseIdentity } from "@/components/CourseIdentity"
import { Button } from "@/components/ui/button"
import {
  formatLastChange,
  joinNames,
  namesOf,
} from "@/features/courseChoice/courseChoiceText"
import { OnlineBackup } from "@/features/settings/OnlineBackup"
import { onDatabaseStatus } from "@/persistence/backupLink"
import { exportCourseArchive } from "@/persistence/courseArchive"
import {
  type CourseChoice,
  readCourseChoices,
} from "@/persistence/courseChoice"
import { dataIsReadOnly, onReadOnly } from "@/persistence/writeGuard"

/**
 * B7: an account holding several courses opens here on every device, instead
 * of locking it (review SC-DT-9). The owner sees them, saves any of them to a
 * file and keeps one; the app never erases one by itself. Approved target:
 * docs/design/mockups/b7-two-courses.html (owner decision 21).
 */
const REFRESH_MS = 3_000
/** How long the device may take to lose the others before it offers to reopen. */
const SLOW_MS = 30_000

type Step =
  | { kind: "choice"; notice?: string }
  | { kind: "confirm"; keepId: string }
  | { kind: "working"; keepId: string }
  | { kind: "failed"; keepId: string; outdated: boolean }
  | { kind: "kept"; keepId: string }

function reopen() {
  window.history.replaceState(null, "", window.location.href)
  window.location.reload()
}

function useOnline() {
  const [online, setOnline] = useState(() => window.navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}

/** The file of one course, saved like Impostazioni's. */
async function saveCourseFile(course: CourseChoice) {
  const archive = await exportCourseArchive(undefined, course.id)
  const code = `${course.family === "Deriva" ? "D" : "C"}${course.level}-${course.isoWeek}`
  const file = new File(
    [JSON.stringify(archive, null, 2)],
    `cvc-helper-corso-${course.year}-${code}-${course.id.slice(0, 8)}.json`,
    { type: "application/json" },
  )
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function SaveFile({
  course,
  label = "Salva file",
  wide = false,
}: {
  course: CourseChoice
  label?: string
  wide?: boolean
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  )
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <Button
        className="h-auto min-h-11 w-full whitespace-normal"
        disabled={state === "saving"}
        onClick={() => {
          setState("saving")
          saveCourseFile(course)
            .then(() => setState("saved"))
            .catch(() => setState("failed"))
        }}
        variant="secondary"
      >
        {state === "saving" ? "Preparazione…" : label}
      </Button>
      {state === "saved" && (
        <p className="mt-1 text-sm leading-5" role="status">
          Salvataggio avviato.
        </p>
      )}
      {state === "failed" && (
        <p className="mt-1 text-sm font-semibold text-[#a2381b]" role="alert">
          File non salvato: riprova.
        </p>
      )}
    </div>
  )
}

function CourseCard({
  course,
  email,
  canChoose,
  readOnly,
  onKeep,
}: {
  course: CourseChoice
  email: string | null
  canChoose: boolean
  readOnly: boolean
  onKeep: () => void
}) {
  return (
    <article
      aria-label={`Corso ${namesOf(course)}`}
      className="mt-3.5 rounded-2xl border bg-card p-3.5"
    >
      <p className="m-0">
        <CourseIdentity {...course} size="compact" />
      </p>
      <p className="mt-0.5 text-sm font-semibold">
        {course.family} · livello {course.level}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Allievi", course.students],
          ["Equipaggi", course.crews],
          ["Valutazioni", course.evaluations],
        ].map(([name, value]) => (
          <div className="min-w-0" key={name}>
            <dt className="text-xs text-muted-foreground">{name}</dt>
            <dd className="m-0 text-base font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-sm leading-[1.35]">
        <span className="text-muted-foreground">Ultima modifica:</span>{" "}
        {formatLastChange(course.lastChange)}
        {email && (
          <>
            <br />
            <span className="[overflow-wrap:anywhere]">{email}</span>
          </>
        )}
      </p>
      {course.unsent > 0 && (
        <p className="mt-2.5 rounded-xl bg-[#fff4ee] px-3 py-2.5 text-sm leading-[1.4] text-[#7f2f17]">
          {course.unsent === 1
            ? "1 modifica fatta su questo telefono non è ancora stata inviata."
            : `${course.unsent} modifiche fatte su questo telefono non sono ancora state inviate.`}
        </p>
      )}
      {/* An app older than the data cannot write a faithful file of it
          (checkCompatibility, src/persistence/courseArchiveFormat.ts). */}
      {!readOnly && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            className="h-auto min-h-11 whitespace-normal"
            disabled={!canChoose}
            onClick={onKeep}
          >
            Tieni questo corso
          </Button>
          <SaveFile course={course} />
        </div>
      )}
    </article>
  )
}

function Confirm({
  keep,
  others,
  onConfirm,
  onCancel,
}: {
  keep: CourseChoice
  others: CourseChoice[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const [understood, setUnderstood] = useState(false)
  const names = joinNames(
    others.map((other) => namesOf(other, [keep, ...others])),
  )
  const several = others.length > 1
  const unsent = others.filter((other) => other.unsent > 0)
  return (
    <section aria-labelledby="course-choice-confirm" className="mt-6">
      <h1
        className="text-2xl leading-[1.15] font-black tracking-tight"
        id="course-choice-confirm"
      >
        Tieni {namesOf(keep, [keep, ...others])}?
      </h1>
      <p className="mt-3 text-sm leading-[1.45]">
        <strong>{names}</strong>{" "}
        {several ? "saranno eliminati" : "sarà eliminato"} da questo telefono,
        dal backup online e dagli altri dispositivi dell’account. Non si{" "}
        {several ? "potranno" : "potrà"} recuperare.
      </p>
      {unsent.map((other) => (
        <p
          className="mt-2.5 rounded-xl bg-[#fff4ee] px-3 py-2.5 text-sm leading-[1.4] text-[#7f2f17]"
          key={other.id}
        >
          {other.unsent === 1
            ? `1 modifica di ${namesOf(other, [keep, ...others])} fatta su questo telefono non è ancora stata inviata: andrà persa.`
            : `${other.unsent} modifiche di ${namesOf(other, [keep, ...others])} fatte su questo telefono non sono ancora state inviate: andranno perse.`}
        </p>
      ))}
      <p className="mt-2.5 text-sm leading-5 text-muted-foreground">
        {PROVIDER_COPIES_TEXT}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {others.map((other) => (
          <SaveFile
            course={other}
            key={other.id}
            label={`Salva prima il file di ${namesOf(other, [keep, ...others])}`}
            wide
          />
        ))}
      </div>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          checked={understood}
          className="size-5 shrink-0 accent-[#b42318]"
          onChange={(event) => setUnderstood(event.target.checked)}
          type="checkbox"
        />
        Ho capito: {names} non si {several ? "potranno" : "potrà"} recuperare
      </label>
      <div className="mt-3 grid gap-2">
        <Button
          className="h-auto min-h-11 whitespace-normal bg-[#b42318] text-white hover:bg-[#9a1f14]"
          disabled={!understood}
          onClick={onConfirm}
        >
          Elimina {names} e apri {namesOf(keep, [keep, ...others])}
        </Button>
        <Button
          className="h-auto min-h-11 whitespace-normal"
          onClick={onCancel}
          variant="secondary"
        >
          Annulla
        </Button>
      </div>
    </section>
  )
}

export function CourseChoiceScreen() {
  const [courses, setCourses] = useState<CourseChoice[] | null>(null)
  const [unreadable, setUnreadable] = useState(false)
  const [step, setStep] = useState<Step>({ kind: "choice" })
  const [slow, setSlow] = useState(false)
  const [readOnly, setReadOnly] = useState(dataIsReadOnly)
  const backup = useBackupState()
  const online = useOnline()

  useEffect(() => onReadOnly(() => setReadOnly(dataIsReadOnly())), [])

  const refresh = useCallback(async () => {
    try {
      const next = await readCourseChoices()
      setUnreadable(false)
      // One course left or none: the choice is over, here or on another device.
      if (next.length <= 1) reopen()
      else setCourses(next)
    } catch {
      setUnreadable(true)
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    const stop = onDatabaseStatus(() => void refresh())
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      stop()
    }
  }, [refresh])

  const keptId = step.kind === "kept" ? step.keepId : null
  useEffect(() => {
    if (!keptId) return
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS)
    return () => window.clearTimeout(timer)
  }, [keptId])

  if (unreadable && !courses)
    return (
      <section className="mt-6" role="alert">
        <h1 className="text-2xl font-black tracking-tight">
          Non riesco a leggere i corsi
        </h1>
        <p className="mt-2 text-sm leading-5">
          Nessun dato è stato cancellato. Riapri l’app per riprovare.
        </p>
        <Button className="mt-4 min-h-11 w-full" onClick={reopen}>
          Riapri l’app
        </Button>
      </section>
    )
  if (!courses)
    return (
      <p className="mt-6 text-sm leading-5" role="status">
        Apertura dei corsi…
      </p>
    )

  const chosen =
    step.kind === "choice"
      ? undefined
      : courses.find((course) => course.id === step.keepId)
  const others = courses.filter((course) => course.id !== chosen?.id)

  const run = (keepId: string) => {
    setStep({ kind: "working", keepId })
    void keepCourse(keepId).then((outcome) => {
      if (outcome === "kept") setStep({ kind: "kept", keepId })
      else if (outcome === "gone")
        setStep({
          kind: "choice",
          notice:
            "Quel corso è già stato eliminato su un altro dispositivo. Attendi: tra poco si apre il corso rimasto.",
        })
      else setStep({ kind: "failed", keepId, outdated: outcome === "outdated" })
    })
  }

  // The course chosen left meanwhile, chosen elsewhere: back to what is here.
  if (step.kind !== "choice" && !chosen) {
    return (
      <p className="mt-6 text-sm leading-5" role="status">
        Aggiornamento dei corsi…
      </p>
    )
  }

  if (step.kind === "confirm" && chosen)
    return (
      <Confirm
        keep={chosen}
        onCancel={() => setStep({ kind: "choice" })}
        onConfirm={() => run(chosen.id)}
        others={others}
      />
    )

  if (step.kind === "working" || step.kind === "kept")
    return (
      <section className="mt-6" role="status">
        <h1 className="text-2xl leading-[1.15] font-black tracking-tight">
          Tieni {chosen && namesOf(chosen, courses)}
        </h1>
        <p className="mt-3 flex items-start gap-2 text-sm leading-5">
          <LoaderCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin"
          />
          {step.kind === "working"
            ? "Invio le modifiche e aggiorno il backup online. Non chiudere l’app."
            : "Scelta salvata nel backup online. Aggiorno questo telefono…"}
        </p>
        {step.kind === "kept" && slow && (
          <>
            <p className="mt-3 text-sm leading-5">
              Ci vuole più del solito. La scelta è salva: gli altri corsi
              spariranno appena il telefono riceve l’aggiornamento.
            </p>
            <Button className="mt-3 min-h-11 w-full" onClick={reopen}>
              Riapri l’app
            </Button>
          </>
        )}
      </section>
    )

  if (step.kind === "failed" && chosen)
    return (
      <section className="mt-6">
        <h1 className="text-2xl leading-[1.15] font-black tracking-tight">
          Tieni {namesOf(chosen, courses)}?
        </h1>
        <p
          className="mt-3 rounded-xl bg-[#fff4ee] px-3 py-2.5 text-sm leading-[1.4] text-[#7f2f17]"
          role="alert"
        >
          {step.outdated
            ? "Questa versione dell’app non può più eliminare un corso dal backup online: aggiorna l’app. Non è cambiato nulla."
            : `Non sono riuscito a eliminare ${joinNames(
                others.map((other) => namesOf(other, courses)),
              )} dal backup online. Non è cambiato nulla: i corsi sono ancora qui.`}
        </p>
        <div className="mt-3 grid gap-2">
          {!step.outdated && (
            <Button
              className="min-h-11 bg-[#b42318] text-white hover:bg-[#9a1f14]"
              onClick={() => run(chosen.id)}
            >
              Riprova
            </Button>
          )}
          <Button
            className="min-h-11"
            onClick={() => setStep({ kind: "choice" })}
            variant="secondary"
          >
            Torna alla scelta
          </Button>
        </div>
      </section>
    )

  const connected = backup.kind === "connected"
  const canChoose = connected && online && !readOnly
  const email =
    backup.kind === "connected" ||
    backup.kind === "offline" ||
    backup.kind === "restoring"
      ? backup.email
      : null
  const count =
    courses.length === 2
      ? "due"
      : courses.length === 3
        ? "tre"
        : `${courses.length}`

  const waiting = backup.kind === "checking" || backup.kind === "restoring"
  const offline = !online || backup.kind === "offline"
  const needsAccess = !readOnly && !offline && !connected && !waiting
  return (
    <section aria-labelledby="course-choice-title" className="mt-6 min-w-0">
      <h1
        className="text-2xl leading-[1.15] font-black tracking-tight"
        id="course-choice-title"
      >
        {readOnly
          ? `${count[0]!.toUpperCase()}${count.slice(1)} corsi su questo account`
          : "Scegli il corso da tenere"}
      </h1>
      {!readOnly && (
        <p className="mt-2 text-sm leading-[1.45] text-muted-foreground">
          Questo account ha {count} corsi, ma l’app ne apre uno solo. Non è
          stato cancellato nulla.
        </p>
      )}
      {step.kind === "choice" && step.notice && (
        <p
          className="mt-3 rounded-xl bg-[#fff4ee] px-3 py-2.5 text-sm leading-[1.4] text-[#7f2f17]"
          role="status"
        >
          {step.notice}
        </p>
      )}
      {readOnly ? (
        <p className="mt-3 text-sm leading-[1.45]">
          Aggiorna l’app per scegliere quale tenere e per salvarne una copia.
        </p>
      ) : offline ? (
        <p className="mt-3 text-sm leading-[1.45]">
          Serve la connessione per scegliere: la scelta vale per tutti i
          dispositivi dell’account. Intanto puoi salvare una copia dei corsi.
        </p>
      ) : waiting ? (
        <p className="mt-3 text-sm leading-[1.45]" role="status">
          Verifica dell’accesso…
        </p>
      ) : needsAccess ? (
        <p className="mt-3 text-sm leading-[1.45]">
          {backup.kind === "unavailable"
            ? "Per scegliere serve il backup online, che questa versione dell’app non ha. Puoi salvare una copia dei corsi."
            : "Per scegliere accedi al backup online: la scelta vale per tutti i dispositivi dell’account. Intanto puoi salvare una copia dei corsi."}
        </p>
      ) : null}
      {courses.map((course) => (
        <CourseCard
          canChoose={canChoose}
          course={course}
          email={email}
          key={course.id}
          onKeep={() => setStep({ kind: "confirm", keepId: course.id })}
          readOnly={readOnly}
        />
      ))}
      {needsAccess && <OnlineBackup />}
    </section>
  )
}
