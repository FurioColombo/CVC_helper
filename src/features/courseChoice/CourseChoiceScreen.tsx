import { LoaderCircle, TriangleAlert } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

import { PROVIDER_COPIES_TEXT } from "@/backup/erasure"
import { type GiveUp, keepCourse, type KeepOutcome } from "@/backup/session"
import { useBackupState } from "@/backup/useBackupState"
import { CourseIdentity } from "@/components/CourseIdentity"
import { Button } from "@/components/ui/button"
import { FullReset, OFF_LOOK } from "@/features/settings/CourseFiles"
import {
  contentsOf,
  formatLastChange,
  joinNames,
  namesOf,
  twinTag,
} from "@/features/courseChoice/courseChoiceText"
import { OnlineBackup } from "@/features/settings/OnlineBackup"
import { onDatabaseStatus } from "@/persistence/backupLink"
import { exportCourseArchive } from "@/persistence/courseArchive"
import {
  clearCourseArrival,
  type CourseChoice,
  readCourseArrival,
  readCourseChoices,
} from "@/persistence/courseChoice"
import { dataIsReadOnly, onReadOnly } from "@/persistence/writeGuard"

/**
 * B7: an account holding several courses opens here on every device, instead
 * of locking it (review SC-DT-9). The owner sees them, saves any of them to a
 * file and keeps one; the app never erases one by itself, and the server erases
 * only what this screen showed. Approved target:
 * docs/design/mockups/b7-two-courses.html (owner decision 21).
 */
const REFRESH_MS = 3_000
/** How long the device may take to lose the others before it offers to reopen. */
const SLOW_MS = 30_000

const GONE_NOTICE =
  "Quel corso non è più nel backup online. Attendi: tra poco si apre il corso rimasto."
const CHANGED_NOTICE =
  "Nel backup online c’è qualcosa che questo telefono non ha ancora ricevuto: un altro corso o modifiche fatte altrove. Questa scelta non ha eliminato nulla. Aspetta l’aggiornamento e scegli di nuovo."
const UPDATED_NOTICE =
  "L’aggiornamento è arrivato: controlla i corsi e scegli di nuovo."
const CONFIRM_UPDATED_NOTICE =
  "Nel frattempo è arrivato un aggiornamento: ricontrolla i corsi e spunta di nuovo la casella."
const LEFT_NOTICE = "Il corso scelto non è più qui: scegli tra quelli rimasti."
const ARRIVAL_NOTICE =
  "L’app si è riaperta da sola perché è arrivato un altro corso. Se stavi scrivendo qualcosa, non è stato salvato."

type FailedReason = Exclude<KeepOutcome, "kept" | "gone" | "changed">

type Step =
  /** `seen`: what was on screen when the notice was true. */
  | { kind: "choice"; notice?: string; seen?: string }
  | { kind: "confirm"; keepId: string; seen: string }
  | { kind: "working"; keepId: string; giveUp: GiveUp }
  | { kind: "failed"; keepId: string; giveUp: GiveUp; reason: FailedReason }
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

/** A refresh never moves a card under the thumb: new ones go last. */
function inShownOrder(shown: CourseChoice[] | null, next: CourseChoice[]) {
  if (!shown) return next
  const place = new Map(shown.map((course, index) => [course.id, index]))
  const placeOf = (course: CourseChoice) => place.get(course.id) ?? shown.length
  return [...next].sort((first, second) => placeOf(first) - placeOf(second))
}

/** Any row of any course changing changes this, whatever its stamp. */
const seenOf = (courses: CourseChoice[]) =>
  courses
    .map((course) => `${course.id}:${course.fingerprint}`)
    .sort()
    .join()

/** Rulebook R06/R14: a warning carries the triangle, not colour alone. */
function Warning({
  children,
  role,
}: {
  children: ReactNode
  role?: "alert" | "status"
}) {
  return (
    <p
      className="mt-2.5 flex items-start gap-2 rounded-xl bg-[#fff4ee] px-3 py-2.5 text-sm leading-[1.4] text-[#7f2f17]"
      role={role}
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-[#b42318]"
      />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** Each step opens at its own question, also at large text sizes. */
function StepHeading({ children, id }: { children: ReactNode; id?: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.closest("main")?.scrollIntoView?.({ block: "start" })
  }, [])
  return (
    <h1
      className="text-2xl leading-[1.15] font-black tracking-tight outline-none"
      id={id}
      ref={heading}
      tabIndex={-1}
    >
      {children}
    </h1>
  )
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
  return file.name
}

type SavedFiles = {
  names: Record<string, string>
  onSaved: (courseId: string, name: string) => void
}

function SaveFile({
  course,
  label = "Salva file",
  wide = false,
  files,
}: {
  course: CourseChoice
  label?: string
  wide?: boolean
  files: SavedFiles
}) {
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle")
  const saved = files.names[course.id]
  return (
    <>
      <div className={wide ? "col-span-full min-w-0" : "min-w-0"}>
        <Button
          className="h-auto min-h-11 w-full whitespace-normal"
          disabled={state === "saving"}
          onClick={() => {
            setState("saving")
            saveCourseFile(course)
              .then((name) => {
                files.onSaved(course.id, name)
                setState("idle")
              })
              .catch(() => setState("failed"))
          }}
          variant="secondary"
        >
          {state === "saving" ? "Preparazione…" : label}
        </Button>
      </div>
      {state === "failed" && (
        <div className="col-span-full min-w-0">
          <Warning role="alert">File non salvato: riprova.</Warning>
        </div>
      )}
      {saved && state !== "failed" && (
        <p className="col-span-full m-0 text-sm leading-5" role="status">
          Salvataggio avviato: cerca{" "}
          <span className="[overflow-wrap:anywhere]">{saved}</span> tra i
          download. Il file contiene i dati personali degli allievi: conservalo
          e condividilo solo con persone autorizzate.
        </p>
      )}
    </>
  )
}

/** Row of two that stacks when the text is large (rulebook R05, R18). */
const ACTION_ROW =
  "mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7.5rem),1fr))] items-start gap-2"

function CourseCard({
  course,
  all,
  email,
  canChoose,
  readOnly,
  onKeep,
  files,
}: {
  course: CourseChoice
  all: CourseChoice[]
  email: string | null
  canChoose: boolean
  readOnly: boolean
  onKeep: () => void
  files: SavedFiles
}) {
  const tag = twinTag(course, all)
  return (
    <article
      aria-label={`Corso ${namesOf(course, all)}`}
      className="mt-3.5 min-w-0 rounded-2xl border bg-card p-3.5"
    >
      <p className="m-0">
        <CourseIdentity {...course} size="compact" />
      </p>
      <p className="mt-0.5 text-sm font-semibold">
        {course.family} · livello {course.level}
      </p>
      {tag && <p className="mt-0.5 text-sm">{tag}</p>}
      <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,4.75rem),1fr))] gap-2">
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
        <Warning>
          {course.unsent === 1
            ? "1 modifica fatta su questo telefono non è ancora stata inviata."
            : `${course.unsent} modifiche fatte su questo telefono non sono ancora state inviate.`}
        </Warning>
      )}
      {/* An app older than the data cannot write a faithful file of it
          (checkCompatibility, src/persistence/courseArchiveFormat.ts). */}
      {!readOnly && (
        <div className={ACTION_ROW}>
          <Button
            className={`h-auto min-h-11 whitespace-normal ${OFF_LOOK}`}
            disabled={!canChoose}
            onClick={onKeep}
          >
            Tieni questo corso
          </Button>
          <SaveFile course={course} files={files} />
        </div>
      )}
    </article>
  )
}

function Confirm({
  keep,
  others,
  updated,
  canChoose,
  onConfirm,
  onCancel,
  files,
}: {
  keep: CourseChoice
  others: CourseChoice[]
  /** What would go changed since this question was first asked. */
  updated: boolean
  canChoose: boolean
  onConfirm: () => void
  onCancel: () => void
  files: SavedFiles
}) {
  const [understood, setUnderstood] = useState(false)
  const all = [keep, ...others]
  const names = joinNames(others.map((other) => namesOf(other, all)))
  const several = others.length > 1
  return (
    <section aria-labelledby="course-choice-confirm" className="mt-6 min-w-0">
      <StepHeading id="course-choice-confirm">
        Tieni {namesOf(keep, all)}?
      </StepHeading>
      {updated && <Warning role="status">{CONFIRM_UPDATED_NOTICE}</Warning>}
      <p className="mt-3 text-sm leading-[1.45]">
        <strong>{names}</strong>{" "}
        {several ? "saranno eliminati" : "sarà eliminato"} da questo telefono,
        dal backup online e dagli altri dispositivi dell’account. Non si{" "}
        {several ? "potranno" : "potrà"} recuperare.
      </p>
      {others.map((other) => (
        <p className="mt-1.5 text-sm leading-[1.45]" key={other.id}>
          {several && `${namesOf(other, all)}: `}
          {several ? contentsOf(other) : `Contiene ${contentsOf(other)}.`}
        </p>
      ))}
      {others
        .filter((other) => other.unsent > 0)
        .map((other) => (
          <Warning key={other.id}>
            {other.unsent === 1
              ? `1 modifica di ${namesOf(other, all)} fatta su questo telefono non è ancora stata inviata: andrà al backup online e sarà eliminata con il corso.`
              : `${other.unsent} modifiche di ${namesOf(other, all)} fatte su questo telefono non sono ancora state inviate: andranno al backup online e saranno eliminate con il corso.`}
          </Warning>
        ))}
      {others
        .filter((other) => other.refused > 0)
        .map((other) => (
          <Warning key={other.id}>
            {other.refused === 1
              ? `1 modifica di ${namesOf(other, all)} rifiutata dal backup online andrà persa.`
              : `${other.refused} modifiche di ${namesOf(other, all)} rifiutate dal backup online andranno perse.`}
          </Warning>
        ))}
      <p className="mt-2.5 text-sm leading-5 text-muted-foreground">
        {PROVIDER_COPIES_TEXT}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {others.map((other) => (
          <SaveFile
            course={other}
            files={files}
            key={other.id}
            label={`Salva prima il file di ${namesOf(other, all)}`}
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
        <span className="min-w-0">
          Ho capito: {names} non si {several ? "potranno" : "potrà"} recuperare
        </span>
      </label>
      {!canChoose && (
        <p className="mt-2 text-sm leading-[1.45]" role="status">
          Serve la connessione per scegliere: la scelta vale per tutti i
          dispositivi dell’account.
        </p>
      )}
      <div className="mt-3 grid gap-2">
        <Button
          className={`h-auto min-h-11 whitespace-normal bg-[#b42318] text-white hover:bg-[#9a1f14] ${OFF_LOOK}`}
          disabled={!understood || !canChoose}
          onClick={onConfirm}
        >
          Elimina {names}
          {several ? "," : ""} e apri {namesOf(keep, all)}
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

function failureText(reason: FailedReason, names: string, several: boolean) {
  switch (reason) {
    case "outdated":
      return "Questa versione dell’app non può più eliminare un corso dal backup online: aggiorna l’app. Non è stato eliminato nulla."
    case "unsent":
      return "Non sono riuscito a inviare le modifiche di questo telefono: la connessione è debole. Non è stato eliminato nulla."
    case "refused":
      return "Il backup online ha rifiutato la scelta. Non è stato eliminato nulla."
    case "no-answer":
      return `Il backup online non ha risposto: la scelta può essere arrivata oppure no. Se è arrivata, ${names} ${several ? "spariranno da soli" : "sparirà da solo"}. Puoi riprovare: ripetere la stessa scelta non elimina altro.`
  }
}

export function CourseChoiceScreen() {
  const [courses, setCourses] = useState<CourseChoice[] | null>(null)
  const [unreadable, setUnreadable] = useState(false)
  const [arrival] = useState(readCourseArrival)
  const [picked, setStep] = useState<Step>({
    kind: "choice",
    notice: arrival ? ARRIVAL_NOTICE : undefined,
  })
  const [slow, setSlow] = useState(false)
  const [readOnly, setReadOnly] = useState(dataIsReadOnly)
  const [savedNames, setSavedNames] = useState<Record<string, string>>({})
  const reading = useRef(false)
  const backup = useBackupState()
  const online = useOnline()

  useEffect(() => onReadOnly(() => setReadOnly(dataIsReadOnly())), [])
  useEffect(() => clearCourseArrival(), [])

  const refresh = useCallback(async () => {
    if (reading.current) return
    reading.current = true
    try {
      const next = await readCourseChoices()
      setUnreadable(false)
      // One course left or none: the choice is over, here or on another device.
      if (next.length <= 1) reopen()
      else setCourses((shown) => inShownOrder(shown, next))
    } catch {
      setUnreadable(true)
    } finally {
      reading.current = false
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

  const keptId = picked.kind === "kept" ? picked.keepId : null
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
    picked.kind === "choice"
      ? undefined
      : courses.find((course) => course.id === picked.keepId)
  // The course chosen left meanwhile, chosen elsewhere: back to what is here.
  const step: Step =
    picked.kind !== "choice" && !chosen
      ? { kind: "choice", notice: LEFT_NOTICE }
      : picked
  const others = courses.filter((course) => course.id !== chosen?.id)
  const files: SavedFiles = {
    names: savedNames,
    onSaved: (courseId, name) =>
      setSavedNames((names) => ({ ...names, [courseId]: name })),
  }

  const connected = backup.kind === "connected"
  const canChoose = connected && online && !readOnly

  const run = (keepId: string, giveUp: GiveUp) => {
    setStep({ kind: "working", keepId, giveUp })
    void keepCourse(keepId, giveUp).then((outcome) => {
      if (outcome === "kept") setStep({ kind: "kept", keepId })
      else if (outcome === "gone")
        setStep({ kind: "choice", notice: GONE_NOTICE })
      else if (outcome === "changed")
        setStep({
          kind: "choice",
          notice: CHANGED_NOTICE,
          seen: seenOf(courses),
        })
      else setStep({ kind: "failed", keepId, giveUp, reason: outcome })
    })
  }

  if (step.kind === "confirm" && chosen)
    return (
      <Confirm
        canChoose={canChoose}
        files={files}
        // A change in what would go asks again: a ticked box answered another
        // question (reviews FU-B7-I3, SC-B7-Q11).
        key={seenOf(others)}
        keep={chosen}
        onCancel={() => setStep({ kind: "choice" })}
        onConfirm={() =>
          run(
            chosen.id,
            Object.fromEntries(
              others.map((other) => [other.id, other.fingerprint]),
            ),
          )
        }
        others={others}
        updated={seenOf(others) !== step.seen}
      />
    )

  if (step.kind === "working" || step.kind === "kept")
    return (
      <section className="mt-6" key="progress" role="status">
        <StepHeading>Tieni {chosen && namesOf(chosen, courses)}</StepHeading>
        <p className="mt-3 flex items-start gap-2 text-sm leading-5">
          <LoaderCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin"
          />
          {step.kind === "working"
            ? "Invio le modifiche e aggiorno il backup online: al massimo un minuto. Non chiudere l’app."
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
      <section className="mt-6" key="failed">
        <StepHeading>Tieni {namesOf(chosen, courses)}?</StepHeading>
        <Warning role="alert">
          {failureText(
            step.reason,
            joinNames(others.map((other) => namesOf(other, courses))),
            others.length > 1,
          )}
        </Warning>
        {step.reason !== "outdated" && !canChoose && (
          <p className="mt-3 text-sm leading-[1.45]" role="status">
            Serve la connessione per riprovare.
          </p>
        )}
        <div className="mt-3 grid gap-2">
          {step.reason !== "outdated" && (
            <Button
              className={`min-h-11 bg-[#b42318] text-white hover:bg-[#9a1f14] ${OFF_LOOK}`}
              disabled={!canChoose}
              onClick={() => run(chosen.id, step.giveUp)}
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
    <section
      aria-labelledby="course-choice-title"
      className="mt-6 min-w-0"
      key="choice"
    >
      <StepHeading id="course-choice-title">
        {readOnly
          ? `${count[0]!.toUpperCase()}${count.slice(1)} corsi su questo account`
          : "Scegli il corso da tenere"}
      </StepHeading>
      {!readOnly && (
        <p className="mt-2 text-sm leading-[1.45] text-muted-foreground">
          Questo account ha {count} corsi, ma l’app ne apre uno solo. Su questo
          telefono ci sono ancora tutti.
        </p>
      )}
      {step.kind === "choice" && step.notice && (
        <Warning role="status">
          {step.seen && step.seen !== seenOf(courses)
            ? UPDATED_NOTICE
            : step.notice}
        </Warning>
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
            : backup.kind === "signed-out" || backup.kind === "link-sent"
              ? "Per scegliere accedi al backup online: la scelta vale per tutti i dispositivi dell’account. Intanto puoi salvare una copia dei corsi."
              : "Per scegliere serve il backup online, che ora non è collegato: trovi cosa fare in fondo a questa pagina. Intanto puoi salvare una copia dei corsi."}
        </p>
      ) : null}
      {courses.map((course) => (
        <CourseCard
          all={courses}
          canChoose={canChoose}
          course={course}
          email={email}
          files={files}
          key={course.id}
          onKeep={() =>
            setStep({
              kind: "confirm",
              keepId: course.id,
              seen: seenOf(courses.filter((other) => other.id !== course.id)),
            })
          }
          readOnly={readOnly}
        />
      ))}
      <OnlineBackup choosing />
      <FullReset courseLabel="i corsi" keepsBackup />
    </section>
  )
}
