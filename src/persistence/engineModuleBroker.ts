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
  type: string
  requestId?: string
  workerId?: string
  moduleKey?: string
  moduleUrl?: string
  event?: EngineEvent
}

const compiledModules = new Map<string, Promise<WebAssembly.Module>>()
let workerSequence = 0

function appendEvent(event: EngineEvent) {
  ;(window.__CVC_ENGINE_DIAGNOSTIC__ ??= []).push(event)
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
      modulePromise = WebAssembly.compileStreaming(fetch(parsedUrl.href))
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
      // The event is in the page recorder before the worker can continue.
      port.postMessage({
        type: "compiled-module",
        requestId,
        module: compiledModule,
      })
    } catch {
      // Structured-clone support is platform dependent. Preserve correctness,
      // but this explicit event makes the cold-start evidence reject fallback.
      appendEvent({ type: "fallback", workerId: ownerWorkerId, moduleKey })
      port.postMessage({ type: "module-fallback", requestId })
    }
  } catch (error) {
    if (compiledModules.get(moduleKey) === modulePromise) {
      compiledModules.delete(moduleKey)
    }
    appendEvent({ type: "error", workerId: ownerWorkerId, moduleKey })
    port.postMessage({
      type: "module-error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export function createEngineStartupWorker(
  options: ResolvedWebSQLOpenOptions,
): Worker | SharedWorker {
  if (
    options.vfs !== "IDBBatchAtomicVFS" ||
    options.encryptionKey ||
    !options.useWebWorker
  ) {
    throw new Error("The engine startup probe cannot change PowerSync storage")
  }

  const workerId = `worker-${++workerSequence}`
  if (options.enableMultiTabs) {
    if (typeof SharedWorker === "undefined") {
      throw new Error("PowerSync selected SharedWorker but it is unavailable")
    }
    // Preserve the SDK's stock SharedWorker entry and its pinned naming policy.
    // The broker seam is used only for SDK-selected dedicated workers.
    return new SharedWorker(
      new URL(
        "../../node_modules/@powersync/web/lib/worker/worker.js",
        import.meta.url,
      ),
      {
        name: `shared-powersync-${options.dbFilename}`,
        type: "module",
      },
    )
  }

  const channel = new MessageChannel()
  const worker = new Worker(
    new URL("./engineModuleWorker.ts", import.meta.url),
    {
      name: `powersync-${options.dbFilename}`,
      type: "module",
    },
  )
  worker.postMessage(
    { type: "cvc-engine-broker-port", workerId, port: channel.port1 },
    [channel.port1],
  )

  const pagePort = channel.port2
  pagePort.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === "release-broker" && message.workerId === workerId) {
      pagePort.close()
      return
    }
    if (message.type === "request-module") {
      void answerModuleRequest(pagePort, message, workerId)
      return
    }
    if (message.type === "record-event" && message.requestId && message.event) {
      appendEvent({ ...message.event, workerId })
      pagePort.postMessage({
        type: "event-recorded",
        requestId: message.requestId,
      })
    }
  })
  pagePort.start()
  return worker
}
