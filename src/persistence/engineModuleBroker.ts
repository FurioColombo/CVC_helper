import type { ResolvedWebSQLOpenOptions } from "@powersync/web"

type EngineEventType =
  | "cache-miss"
  | "cache-hit"
  | "compile-start"
  | "compile-complete"
  | "instance-created"
  | "fallback"
  | "error"

type EngineEvent = {
  type: EngineEventType
  workerId: string
  moduleKey: string
  instanceId?: string
  elapsedMs?: number
}

declare global {
  interface Window {
    __CVC_ENGINE_DIAGNOSTIC__?: EngineEvent[]
  }
}

type WorkerMessage = {
  type?: string
  requestId?: string
  workerId?: string
  moduleKey?: string
  moduleUrl?: string
  event?: EngineEvent
}

const STARTUP_FAILURE_TIMEOUT_MS = 30_000
const MODULE_COMPILE_TIMEOUT_MS = 30_000
const MAX_DIAGNOSTIC_EVENTS = 128

const compiledModules = new Map<string, Promise<WebAssembly.Module>>()
let workerSequence = 0

function appendEvent(event: EngineEvent) {
  if (!import.meta.env.DEV) return

  const events = (window.__CVC_ENGINE_DIAGNOSTIC__ ??= [])
  events.push(event)
  if (events.length > MAX_DIAGNOSTIC_EVENTS) {
    events.splice(0, events.length - MAX_DIAGNOSTIC_EVENTS)
  }
}

function sendReply(port: MessagePort, message: Record<string, unknown>) {
  try {
    port.postMessage(message)
  } catch {
    // The worker may already have closed its side of the startup channel.
  }
}

function isDataCloneError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "DataCloneError"
  )
}

async function compileModule(url: string) {
  const controller = new AbortController()
  let timeout: number | undefined

  const compilePromise = WebAssembly.compileStreaming(
    fetch(url, { signal: controller.signal }),
  )
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => {
      controller.abort()
      reject(new Error("Timed out compiling the PowerSync WASM module"))
    }, MODULE_COMPILE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([compilePromise, timeoutPromise])
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout)
  }
}

async function answerModuleRequest(
  port: MessagePort,
  message: WorkerMessage,
  ownerWorkerId: string,
) {
  const { moduleKey, moduleUrl, requestId } = message
  if (!moduleKey || !moduleUrl || !requestId) return

  let modulePromise: Promise<WebAssembly.Module> | undefined
  try {
    const parsedUrl = new URL(moduleUrl, window.location.href)
    if (
      parsedUrl.href !== moduleKey ||
      parsedUrl.origin !== window.location.origin
    ) {
      throw new Error(
        "The startup broker rejected an unexpected WASM asset URL",
      )
    }

    modulePromise = compiledModules.get(moduleKey)
    let compiledModule: WebAssembly.Module
    if (modulePromise) {
      compiledModule = await modulePromise
      appendEvent({ type: "cache-hit", workerId: ownerWorkerId, moduleKey })
    } else {
      appendEvent({ type: "cache-miss", workerId: ownerWorkerId, moduleKey })
      appendEvent({ type: "compile-start", workerId: ownerWorkerId, moduleKey })
      const compileStarted = performance.now()
      modulePromise = compileModule(parsedUrl.href)
      compiledModules.set(moduleKey, modulePromise)
      compiledModule = await modulePromise
      appendEvent({
        type: "compile-complete",
        workerId: ownerWorkerId,
        moduleKey,
        elapsedMs: Math.round(performance.now() - compileStarted),
      })
    }

    try {
      port.postMessage({
        type: "compiled-module",
        requestId,
        module: compiledModule,
      })
    } catch (error) {
      if (!isDataCloneError(error)) throw error

      appendEvent({ type: "fallback", workerId: ownerWorkerId, moduleKey })
      port.postMessage({ type: "module-fallback", requestId })
    }
  } catch (error) {
    if (compiledModules.get(moduleKey) === modulePromise) {
      compiledModules.delete(moduleKey)
    }
    appendEvent({ type: "error", workerId: ownerWorkerId, moduleKey })
    sendReply(port, {
      type: "module-error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function startDedicatedScope() {
  let resolveFailure!: (error: Error) => void
  let deadline: number | undefined
  let drainDeadline: number | undefined
  const workers = new Map<
    Worker,
    { onError: (event: ErrorEvent) => void; onMessageError: () => void }
  >()
  const ports = new Set<MessagePort>()
  let released = false
  let failed = false

  const failure = new Promise<Error>((resolve) => {
    resolveFailure = resolve
  })

  const closePorts = () => {
    if (drainDeadline !== undefined) {
      window.clearTimeout(drainDeadline)
      drainDeadline = undefined
    }
    for (const port of ports) port.close()
    ports.clear()
  }

  const stopObserving = (terminateWorkers: boolean) => {
    if (deadline !== undefined) {
      window.clearTimeout(deadline)
      deadline = undefined
    }
    for (const [worker, listeners] of workers) {
      worker.removeEventListener("error", listeners.onError)
      worker.removeEventListener("messageerror", listeners.onMessageError)
      if (terminateWorkers) worker.terminate()
    }
    workers.clear()
    if (terminateWorkers) closePorts()
  }

  const cleanupFailedInitialization = () => {
    if (released) return
    released = true
    stopObserving(true)
  }

  const release = () => {
    if (released) return
    released = true
    stopObserving(false)
    // The SDK's readiness reply uses a different channel. Let the broker's
    // ordered diagnostics/release messages drain without delaying readiness.
    if (ports.size > 0) {
      drainDeadline = window.setTimeout(closePorts, STARTUP_FAILURE_TIMEOUT_MS)
    }
  }

  const fail = (error: Error) => {
    if (released || failed) return
    failed = true
    resolveFailure(error)
    cleanupFailedInitialization()
  }

  const startDeadline = () => {
    if (deadline !== undefined) return
    deadline = window.setTimeout(() => {
      fail(
        new Error(
          "PowerSync dedicated-worker initialization did not settle within 30 seconds",
        ),
      )
    }, STARTUP_FAILURE_TIMEOUT_MS)
  }

  const createWorker = (options: ResolvedWebSQLOpenOptions) => {
    if (
      options.vfs !== "IDBBatchAtomicVFS" ||
      options.encryptionKey ||
      !options.useWebWorker
    ) {
      throw new Error("The startup broker cannot change PowerSync storage")
    }

    if (options.enableMultiTabs) {
      if (typeof SharedWorker === "undefined") {
        throw new Error("PowerSync selected SharedWorker but it is unavailable")
      }
      // Keep the pinned SDK SharedWorker entry and naming policy unchanged.
      return new SharedWorker(
        new URL(
          "../../node_modules/@powersync/web/lib/worker/worker.js",
          import.meta.url,
        ),
        {
          name: "shared-powersync-" + options.dbFilename,
          type: "module",
        },
      )
    }

    startDeadline()
    const workerId = "worker-" + ++workerSequence
    const channel = new MessageChannel()
    const pagePort = channel.port2
    let worker: Worker
    try {
      worker = new Worker(new URL("./engineModuleWorker.ts", import.meta.url), {
        name: "powersync-" + options.dbFilename,
        type: "module",
      })
    } catch (error) {
      channel.port1.close()
      pagePort.close()
      fail(
        error instanceof Error
          ? error
          : new Error("Could not start the PowerSync dedicated worker"),
      )
      throw error
    }

    const onError = (event: ErrorEvent) => {
      fail(
        new Error(
          event.message || "PowerSync dedicated worker failed during startup",
        ),
      )
    }
    const onMessageError = () => {
      fail(
        new Error("PowerSync dedicated worker sent an invalid startup message"),
      )
    }
    worker.addEventListener("error", onError)
    worker.addEventListener("messageerror", onMessageError)
    workers.set(worker, { onError, onMessageError })
    ports.add(pagePort)

    pagePort.addEventListener(
      "message",
      (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (!message || typeof message.type !== "string") return
        if (
          message.type === "release-broker" &&
          message.workerId === workerId
        ) {
          pagePort.close()
          ports.delete(pagePort)
          if (ports.size === 0 && drainDeadline !== undefined) {
            window.clearTimeout(drainDeadline)
            drainDeadline = undefined
          }
          return
        }
        if (message.type === "request-module") {
          void answerModuleRequest(pagePort, message, workerId)
          return
        }
        if (message.type === "record-event" && message.event) {
          appendEvent({ ...message.event, workerId })
        }
      },
    )
    pagePort.start()

    try {
      worker.postMessage(
        { type: "cvc-engine-broker-port", workerId, port: channel.port1 },
        [channel.port1],
      )
    } catch (error) {
      channel.port1.close()
      pagePort.close()
      ports.delete(pagePort)
      fail(
        error instanceof Error
          ? error
          : new Error("Could not connect the PowerSync startup broker"),
      )
      throw error
    }

    return worker
  }

  return {
    failure,
    cleanupFailedInitialization,
    release,
    createWorker,
  }
}

export function createEngineStartupWorkerScope() {
  const scope = startDedicatedScope()
  return {
    createWorker: scope.createWorker,
    failure: scope.failure,
    cleanupFailedInitialization: scope.cleanupFailedInitialization,
    release: scope.release,
  }
}
