// The startup Vite config aliases only the SDK's unqueried async-factory
// import here. The query keeps this import bound to the pinned stock factory.
// @ts-expect-error WA-SQLite publishes its generated Emscripten module without declarations.
import stockFactory from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs?cvc-original"
import wasmUrl from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url"

type EngineEventType = "instance-created" | "error"

type WorkerBroker = {
  workerId: string
  port: MessagePort
}

type WorkerState = {
  brokers: WorkerBroker[]
  requestSequence: number
  instanceSequence: number
}

type BrokerReply = {
  type: string
  requestId?: string
  module?: WebAssembly.Module
  message?: string
}

type EmscriptenFactory = (options?: {
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    receiveInstance: (
      instance: WebAssembly.Instance,
      module: WebAssembly.Module,
    ) => void,
  ) => WebAssembly.Exports
}) => Promise<unknown>

declare global {
  var __CVC_ENGINE_WORKER_STATE__: WorkerState | undefined
}

const BROKER_REQUEST_TIMEOUT_MS = 30_000
const factory = stockFactory as EmscriptenFactory

function sendRequest(
  broker: WorkerBroker,
  type: string,
  values: Record<string, unknown>,
): Promise<BrokerReply> {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__!
  const requestId = broker.workerId + "-request-" + ++state.requestSequence

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      broker.port.removeEventListener("message", receive)
      broker.port.removeEventListener("messageerror", receiveError)
    }
    const receive = (event: MessageEvent<BrokerReply>) => {
      if (event.data?.requestId !== requestId) return
      cleanup()
      if (event.data.type === "module-error") {
        reject(new Error(event.data.message ?? "WASM compile failed"))
      } else if (
        event.data.type === "compiled-module" ||
        event.data.type === "module-fallback"
      ) {
        resolve(event.data)
      } else {
        reject(new Error("The startup broker returned an unknown response"))
      }
    }
    const receiveError = () => {
      cleanup()
      reject(new Error("The PowerSync startup broker message was invalid"))
    }

    broker.port.addEventListener("message", receive)
    broker.port.addEventListener("messageerror", receiveError)
    broker.port.start()
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Timed out waiting for the PowerSync startup broker"))
    }, BROKER_REQUEST_TIMEOUT_MS)

    try {
      broker.port.postMessage({ type, requestId, ...values })
    } catch (error) {
      cleanup()
      reject(
        error instanceof Error
          ? error
          : new Error("Could not send a PowerSync startup broker request"),
      )
    }
  })
}

function report(
  broker: WorkerBroker,
  type: EngineEventType,
  moduleKey: string,
  instanceId?: string,
) {
  if (!import.meta.env.DEV) return
  try {
    broker.port.postMessage({
      type: "record-event",
      event: { type, workerId: broker.workerId, moduleKey, instanceId },
    })
  } catch {
    // Diagnostics must not affect database initialization.
  }
}

function discardBroker(broker: WorkerBroker) {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__
  if (!state) return
  state.brokers = state.brokers.filter(({ port }) => port !== broker.port)
  try {
    broker.port.postMessage({
      type: "release-broker",
      workerId: broker.workerId,
    })
  } catch {
    // The main thread may already have closed its side during cleanup.
  }
  broker.port.close()
}

export default async function createWaSqliteModule(): Promise<unknown> {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__
  if (!state) return factory()

  const broker = state.brokers.at(-1)
  if (!broker) {
    throw new Error(
      "The dedicated PowerSync worker did not receive its startup broker",
    )
  }

  const moduleKey = new URL(wasmUrl, self.location.href).href
  const instanceId = broker.workerId + "-instance-" + ++state.instanceSequence

  try {
    const response = await sendRequest(broker, "request-module", {
      moduleKey,
      moduleUrl: moduleKey,
    })
    if (response.type === "module-fallback") {
      // Structured cloning is optional on some runtimes; this preserves data
      // correctness while DEV diagnostics keep the fallback out of timing PASS.
      const fallbackModule = await factory()
      report(broker, "instance-created", moduleKey, instanceId)
      return fallbackModule
    }
    if (response.type !== "compiled-module" || !response.module) {
      throw new Error(
        "The startup broker returned no compiled WebAssembly.Module",
      )
    }

    const module = response.module
    const freshModule = await factory({
      instantiateWasm(imports, receiveInstance) {
        const instance = new WebAssembly.Instance(module, imports)
        receiveInstance(instance, module)
        return instance.exports
      },
    })
    report(broker, "instance-created", moduleKey, instanceId)
    return freshModule
  } catch (error) {
    report(broker, "error", moduleKey, instanceId)
    throw error
  } finally {
    discardBroker(broker)
  }
}
