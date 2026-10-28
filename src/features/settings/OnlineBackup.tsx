import {
  CircleCheck,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { type FormEvent, useEffect, useRef, useState } from "react"

import { backupConfig } from "@/backup/config"
import { ERASURE_RETENTION_TEXT } from "@/backup/erasure"
import {
  backupState,
  type BackupState,
  forgetLinkSent,
  onBackupState,
  reopenApp,
  resumeBackup,
  sendSignInLink,
  setBackupState,
  signInWithCode,
  replaceWithOnlineCourse,
  signOutOfBackup,
} from "@/backup/session"
import { Button } from "@/components/ui/button"
import { appChannel } from "@/runtimeConfig"
import {
  lastUploadFailed,
  onDatabaseStatus,
  pendingUploads,
  awaitingServerErase,
  discardUploadRefusals,
  forgetSupersededEdits,
  retryUploadRefusals,
  supersededEdits,
  type UploadRefusal,
  uploadRefusals,
} from "@/persistence/backupLink"

/**
 * B3: the online backup in Impostazioni. Absent when the build has no backup
 * (the regular app until production exists). Signed out, one email field and
 * one action; signed in, the account, what is still to send, and sign-out,
 * which keeps the course on the device.
 */
export function OnlineBackup({
  restore = false,
}: {
  /** On the empty device's screen: the section offers to restore. */
  restore?: boolean
}) {
  const configured = backupConfig() !== null
  const [state, setState] = useState<BackupState>(backupState)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => onBackupState(setState), [])
  if (!configured || state.kind === "unavailable") return null

  const run = async (action: () => Promise<BackupState>) => {
    setBusy(true)
    try {
      setBackupState(await action())
    } catch {
      setBackupState({
        kind: "error",
        message: "Backup non raggiungibile. Riprova con la connessione.",
      })
    } finally {
      setBusy(false)
    }
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (email.trim()) void run(() => sendSignInLink(email.trim()))
  }

  const retry = async () => {
    await resumeBackup(true)
    return backupState()
  }

  return (
    <section
      aria-labelledby="online-backup-title"
      className="mt-6 border-t pt-5"
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold text-primary"
        id="online-backup-title"
      >
        <CloudUpload aria-hidden="true" className="size-4 shrink-0" />
        {restore ? "Ripristina dal backup online" : "Backup online"}
      </h2>
      {state.kind === "checking" && (
        <p
          className="mt-2 text-sm leading-5 text-muted-foreground"
          role="status"
        >
          Verifica dell’accesso…
        </p>
      )}
      {state.kind === "signed-out" && (
        <form className="mt-2" onSubmit={send}>
          <p className="text-sm leading-5 text-muted-foreground">
            {restore
              ? "Hai già un corso nel backup online? Accedi con la tua email per ripristinarlo su questo telefono."
              : "Accedi con la tua email per copiare il corso online e ritrovarlo su un altro telefono. Senza accesso l’app funziona come sempre, solo su questo telefono."}
          </p>
          {appChannel === "test" && (
            <p className="mt-2 text-sm font-semibold leading-5 text-[#9a3412]">
              App di prova con un backup di sviluppo: usa solo persone
              inventate.
            </p>
          )}
          <label
            className="mt-3 block text-sm font-semibold"
            htmlFor="backup-email"
          >
            Email
          </label>
          <input
            autoComplete="email"
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 text-base"
            id="backup-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <Button className="mt-3" disabled={busy} type="submit">
            Invia il link di accesso
          </Button>
          {state.notice && <Notice>{state.notice}</Notice>}
        </form>
      )}
      {state.kind === "link-sent" && (
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault()
            const typed = code.replace(/\s/g, "")
            if (typed) void run(() => signInWithCode(state.email, typed))
          }}
        >
          <p className="text-sm leading-5" role="status">
            Link inviato a{" "}
            <span className="font-bold [overflow-wrap:anywhere]">
              {state.email}
            </span>
            . Aprilo su questo telefono, nel browser di questa app. Se si apre
            altrove, scrivi qui il codice dell’email.
          </p>
          <label
            className="mt-3 block text-sm font-semibold"
            htmlFor="backup-code"
          >
            Codice dell’email
          </label>
          <input
            autoComplete="one-time-code"
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 text-base tracking-widest"
            id="backup-code"
            inputMode="numeric"
            maxLength={12}
            onChange={(event) => setCode(event.target.value)}
            value={code}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy || !code.trim()} type="submit">
              Accedi con il codice
            </Button>
            <Button
              onClick={() => {
                setCode("")
                setBackupState(forgetLinkSent())
              }}
              type="button"
              variant="secondary"
            >
              Usa un’altra email
            </Button>
          </div>
          {state.notice && <Notice>{state.notice}</Notice>}
        </form>
      )}
      {(state.kind === "connected" || state.kind === "offline") && (
        <Connected
          busy={busy}
          email={state.email}
          onSignOut={() => void run(signOutOfBackup)}
          outdated={state.kind === "connected" && !!state.outdated}
          reachable={state.kind === "connected"}
        />
      )}
      {state.kind === "reopen" && (
        <div className="mt-2" role="status">
          <p className="text-sm leading-5">
            Backup pronto. Riapri l’app per attivarlo.
          </p>
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() =>
              void run(async () => (await reopenApp(), backupState()))
            }
          >
            Riapri l’app
          </Button>
        </div>
      )}
      {state.kind === "replace-course" && (
        <ReplaceCourse
          busy={busy}
          online={state.online}
          onCancel={() => void run(signOutOfBackup)}
          onReplace={() => void run(replaceWithOnlineCourse)}
        />
      )}
      {state.kind === "restoring" && (
        <div className="mt-2" role="status">
          <p className="text-sm leading-5">
            Accesso:{" "}
            <span className="font-bold [overflow-wrap:anywhere]">
              {state.email}
            </span>
            . Ripristino del corso dal backup online… Serve la connessione:
            l’app si riapre con il corso appena è scaricato.
          </p>
          {/* A way out of a restore that cannot download (SC-B5-5). */}
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => void run(signOutOfBackup)}
            variant="secondary"
          >
            Esci dall’account
          </Button>
        </div>
      )}
      {state.kind === "other-account" && (
        <Notice>
          Questo telefono è collegato a un altro account. Esci e accedi con
          quello: il corso e le modifiche da inviare restano suoi.
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => void run(signOutOfBackup)}
            variant="secondary"
          >
            Esci dall’account
          </Button>
        </Notice>
      )}
      {state.kind === "error" && (
        <Notice>
          {state.message}
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => void run(retry)}
            variant="secondary"
          >
            Riprova
          </Button>
        </Notice>
      )}
    </section>
  )
}

/**
 * B5: the account holds another course than this device. Replacing erases
 * the course here, as "Elimina il corso" does, and asks the same way: an
 * explicit acknowledgement first. Nothing is merged.
 */
function ReplaceCourse({
  online,
  busy,
  onReplace,
  onCancel,
}: {
  online: string
  busy: boolean
  onReplace: () => void
  onCancel: () => void
}) {
  const [understood, setUnderstood] = useState(false)
  return (
    <div
      className="mt-2 text-sm leading-5"
      role="alertdialog"
      aria-labelledby="replace-q"
    >
      <p id="replace-q">
        Questo account ha già un corso online
        {online ? (
          <>
            :{" "}
            <span className="font-bold [overflow-wrap:anywhere]">{online}</span>
          </>
        ) : null}
        . Puoi sostituire il corso di questo telefono con quello online: il
        corso di questo telefono verrà eliminato. Se vuoi conservarne una copia,
        esportalo prima.
      </p>
      <label className="mt-3 flex min-h-11 items-start gap-2">
        <input
          checked={understood}
          className="mt-1 size-4"
          onChange={(event) => setUnderstood(event.target.checked)}
          type="checkbox"
        />
        <span>Ho capito: il corso di questo telefono sarà eliminato</span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy || !understood}
          onClick={onReplace}
          variant="secondary"
        >
          Sostituisci con il corso online
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Annulla ed esci
        </Button>
      </div>
    </div>
  )
}

/** Where the course is kept, for the Impostazioni summary (FUX-B3-Q3). */
export function ArchiveSummary() {
  const [state, setState] = useState<BackupState>(backupState)
  useEffect(() => onBackupState(setState), [])
  return state.kind === "connected" || state.kind === "offline"
    ? "Locale, con backup online"
    : "Locale"
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex gap-2 text-sm leading-5" role="alert">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-[#b45309]"
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

const changes = (count: number) =>
  count === 1 ? "1 modifica" : `${count} modifiche`

type Status = { icon: "done" | "sending" | "waiting"; text: string }

const STATUS_ICONS = {
  done: CircleCheck,
  sending: RefreshCw,
  waiting: CloudOff,
}

/** Why the backup refused changes, in the owner's words (B4). */
const REFUSAL_TEXT: Record<string, string> = {
  "other-account":
    "Il corso risulta già di un altro account online, quindi il backup non lo accetta da questo.",
  access: "Riguardano un corso che il backup non attribuisce a questo account.",
  data: "Contengono dati che il backup non accetta.",
  missing:
    "Modificano dati che il backup non ha più, forse eliminati da un altro telefono.",
  erased:
    "Riguardano un corso eliminato dal backup online da un altro telefono.",
}

function Connected({
  email,
  busy,
  onSignOut,
  outdated,
  reachable,
}: {
  email: string
  busy: boolean
  onSignOut: () => void
  outdated: boolean
  /** The backup is connected (not waiting for signal to sign in again). */
  reachable: boolean
}) {
  const [status, setStatus] = useState<Status>({
    icon: "sending",
    text: "Verifica della copia online…",
  })
  const [waiting, setWaiting] = useState(0)
  const [refused, setRefused] = useState<UploadRefusal[]>([])
  const [unsendable, setUnsendable] = useState(0)
  const [superseded, setSuperseded] = useState(0)
  const [discarding, setDiscarding] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [round, setRound] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [erasePending, setErasePending] = useState(false)
  const question = useRef<HTMLDivElement>(null)

  // At large text sizes the question opens below the fold (FUX-B3-R2-Q4).
  useEffect(() => {
    if (confirming) question.current?.scrollIntoView({ block: "nearest" })
  }, [confirming])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const [pending, refusals, overtaken, erasing] = await Promise.all([
        pendingUploads(),
        uploadRefusals(),
        supersededEdits(),
        awaitingServerErase(),
      ])
      // The status follows the uploads, not the download stream: with every
      // change sent the copy online is up to date, whatever the download
      // does (owner check B4-PHONE-UPLOADS, 2026-10-28).
      const online = reachable && window.navigator.onLine
      // With changes waiting, they move only while uploads succeed.
      const connected = online && (pending === 0 || !lastUploadFailed())
      if (!active) return
      setWaiting(pending)
      setErasePending(erasing)
      // B6: a course erased here offline is still online (review SP-B6-2).
      if (erasing) {
        setStatus({
          icon: "waiting",
          text: "In attesa di connessione: il corso eliminato qui è ancora nel backup online.",
        })
        return
      }
      setRefused(refusals)
      setSuperseded(overtaken)
      setStatus(
        !connected
          ? pending > 0
            ? {
                icon: "waiting",
                text: `In attesa di connessione: ${changes(pending)} da inviare.`,
              }
            : // Every change was accepted: nothing is missing online
              // (review FUX-B3-Q5).
              refusals.length > 0
              ? { icon: "waiting", text: "Ora senza connessione." }
              : {
                  icon: "waiting",
                  text: "Tutto inviato. Ora senza connessione.",
                }
          : pending > 0
            ? {
                icon: "sending",
                text: `Invio in corso: ${changes(pending)} da inviare.`,
              }
            : refusals.length > 0
              ? {
                  icon: "waiting",
                  text: `Copia online aggiornata, tranne ${changes(refusals.length)} ${refusals.length === 1 ? "rifiutata" : "rifiutate"}.`,
                }
              : { icon: "done", text: "Copia online aggiornata." },
      )
    }
    void refresh()
    const stop = onDatabaseStatus(() => void refresh())
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      active = false
      stop()
      window.clearInterval(timer)
    }
  }, [round, reachable])

  // Applied again, the changes queue for upload; what cannot be rebuilt
  // here stays listed (src/persistence/backupLink.ts).
  const retry = async () => {
    setRetrying(true)
    try {
      setUnsendable(await retryUploadRefusals())
    } finally {
      setRetrying(false)
      setRound((value) => value + 1)
    }
  }
  const reasons = [...new Set(refused.map(({ reason }) => reason))]
  const discard = async () => {
    await discardUploadRefusals()
    setDiscarding(false)
    setUnsendable(0)
    setRound((value) => value + 1)
  }
  const acknowledge = async () => {
    await forgetSupersededEdits()
    setRound((value) => value + 1)
  }

  const Icon = STATUS_ICONS[status.icon]
  return (
    <div className="mt-2">
      <p className="text-sm leading-5">
        Accesso:{" "}
        <span className="font-bold [overflow-wrap:anywhere]">{email}</span>
      </p>
      <p
        className="mt-2 flex items-start gap-2 text-base font-semibold leading-6"
        role="status"
      >
        <Icon
          aria-hidden="true"
          className={`mt-1 size-4 shrink-0 ${status.icon === "done" ? "text-[#15803d]" : "text-[#b45309]"}`}
        />
        <span className="min-w-0">{status.text}</span>
      </p>
      {outdated && (
        <Notice>
          Questa versione dell’app non può più inviare modifiche al backup.
          Aggiorna l’app: intanto le modifiche restano su questo telefono.
        </Notice>
      )}
      {refused.length > 0 && (
        // A refused change is never dropped in silence (04 B4): it stays on
        // this phone, listed here, until it is sent again.
        <Notice>
          Il backup ha rifiutato {changes(refused.length)}: restano su questo
          telefono.
          <ul className="mt-1 list-disc pl-5">
            {reasons.map((reason) => (
              <li key={reason}>{REFUSAL_TEXT[reason] ?? REFUSAL_TEXT.data}</li>
            ))}
          </ul>
          {unsendable > 0 && (
            <p className="mt-1">
              {unsendable === 1
                ? "1 modifica non si può reinviare da qui."
                : `${unsendable} modifiche non si possono reinviare da qui.`}
            </p>
          )}
          {discarding ? (
            <div className="mt-3">
              <p>
                Le modifiche tolte non arriveranno alla copia online. Il corso
                su questo telefono non cambia.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => void discard()} variant="secondary">
                  Togli
                </Button>
                <Button onClick={() => setDiscarding(false)}>Annulla</Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={retrying}
                onClick={() => void retry()}
                variant="secondary"
              >
                Riprova l’invio
              </Button>
              <Button onClick={() => setDiscarding(true)} variant="secondary">
                Togli dall’elenco
              </Button>
            </div>
          )}
        </Notice>
      )}
      {superseded > 0 && (
        // Owner decision 12: two phones edited offline, the latest edit
        // stands, and the app says so.
        <div className="mt-3 text-sm leading-5" role="status">
          <p>
            {superseded === 1
              ? "1 modifica fatta senza connessione era già superata da una più recente di un altro telefono: resta l’ultima."
              : `${superseded} modifiche fatte senza connessione erano già superate da altre più recenti di un altro telefono: restano le ultime.`}
          </p>
          <Button
            className="mt-2"
            onClick={() => void acknowledge()}
            variant="secondary"
          >
            Ho capito
          </Button>
        </div>
      )}
      {confirming ? (
        // A wrong tap on Esci costs a new link and signal to undo (review
        // FUX-B3-6): it asks first, saying what stays behind.
        <div
          aria-labelledby="sign-out-q"
          className="mt-3"
          ref={question}
          role="alertdialog"
        >
          <p className="text-sm leading-5" id="sign-out-q">
            {waiting > 0
              ? `Uscire? ${changes(waiting)} ${waiting === 1 ? "non è ancora online: resta" : "non sono ancora online: restano"} su questo telefono e ${waiting === 1 ? "parte" : "partono"} quando rientri con questo account.`
              : "Uscire dal backup? Il corso resta su questo telefono."}
          </p>
          {erasePending && (
            <p className="mt-1 text-sm font-semibold leading-5">
              Il corso eliminato qui è ancora nel backup online: sarà tolto solo
              quando rientri con questo account da questo telefono.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={onSignOut} variant="secondary">
              Esci
            </Button>
            <Button onClick={() => setConfirming(false)}>
              Resta collegato
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => setConfirming(true)}
            variant="secondary"
          >
            Esci
          </Button>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            Il corso resta su questo telefono.
          </p>
        </>
      )}
      <p className="mt-3 text-sm leading-5 text-muted-foreground">
        {ERASURE_RETENTION_TEXT}
      </p>
    </div>
  )
}
