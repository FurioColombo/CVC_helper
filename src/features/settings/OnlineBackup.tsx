import {
  CircleCheck,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"

import { backupConfig } from "@/backup/config"
import {
  backupState,
  type BackupState,
  forgetLinkSent,
  onBackupState,
  resumeBackup,
  sendSignInLink,
  setBackupState,
  signInWithCode,
  signOutOfBackup,
} from "@/backup/session"
import { Button } from "@/components/ui/button"
import { appChannel } from "@/runtimeConfig"
import {
  databaseConnected,
  onDatabaseStatus,
  pendingUploads,
} from "@/persistence/backupLink"

/**
 * B3: the online backup in Impostazioni. Absent when the build has no backup
 * (the regular app until production exists). Signed out, one email field and
 * one action; signed in, the account, what is still to send, and sign-out,
 * which keeps the course on the device.
 */
export function OnlineBackup() {
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
    await resumeBackup()
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
        Backup online
      </h2>
      {state.kind === "signed-out" && (
        <form className="mt-2" onSubmit={send}>
          <p className="text-sm leading-5 text-muted-foreground">
            Accedi con la tua email per copiare il corso online e ritrovarlo su
            un altro telefono. Senza accesso l’app funziona come sempre, solo su
            questo telefono.
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
        />
      )}
      {state.kind === "reopen" && (
        <div className="mt-2" role="status">
          <p className="text-sm leading-5">
            Backup pronto. Riapri l’app per attivarlo.
          </p>
          <Button className="mt-3" onClick={() => window.location.reload()}>
            Riapri l’app
          </Button>
        </div>
      )}
      {state.kind === "other-course" && (
        <Notice>
          Questo account ha già un altro corso online. Il corso di questo
          telefono resta solo qui.
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

type Status = { icon: "done" | "sending" | "waiting"; text: string }

const STATUS_ICONS = {
  done: CircleCheck,
  sending: RefreshCw,
  waiting: CloudOff,
}

function Connected({
  email,
  busy,
  onSignOut,
}: {
  email: string
  busy: boolean
  onSignOut: () => void
}) {
  const [status, setStatus] = useState<Status>({
    icon: "sending",
    text: "Verifica della copia online…",
  })
  const [waiting, setWaiting] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const pending = await pendingUploads()
      const connected = databaseConnected()
      if (!active) return
      setWaiting(pending)
      setStatus(
        !connected
          ? pending > 0
            ? {
                icon: "waiting",
                text: `In attesa di connessione: ${pending} modifiche da inviare.`,
              }
            : // Every change was accepted: nothing is missing online
              // (review FUX-B3-Q5).
              { icon: "waiting", text: "Tutto inviato. Ora senza connessione." }
          : pending > 0
            ? {
                icon: "sending",
                text: `Invio in corso: ${pending} modifiche da inviare.`,
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
  }, [])

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
      {confirming ? (
        // A wrong tap on Esci costs a new link and signal to undo (review
        // FUX-B3-6): it asks first, saying what stays behind.
        <div className="mt-3" role="alertdialog" aria-labelledby="sign-out-q">
          <p className="text-sm leading-5" id="sign-out-q">
            {waiting > 0
              ? `Uscire? ${waiting} modifiche non sono ancora online: restano su questo telefono e partono quando rientri con questo account.`
              : "Uscire dal backup? Il corso resta su questo telefono."}
          </p>
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
    </div>
  )
}
