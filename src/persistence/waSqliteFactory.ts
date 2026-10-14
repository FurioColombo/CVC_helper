// The startup Vite config aliases only the SDK's unqueried async-factory
// import here. The query keeps this import bound to the pinned stock factory.
// @ts-expect-error WA-SQLite publishes its generated Emscripten module without declarations.
import stockFactory from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs?cvc-original"
import wasmUrl from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url"

type EngineEventType = "instance-created" | "fallback" | "error"

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

function sendRequest(
  broker: WorkerBroker,
  type: string,
  values: Record<string, unknown>,
): Promise<BrokerReply> {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__!
  const requestId = `${broker.workerId}-request-${++state.requestSequence}`

  return new Promise((resolve, reject) => {
    const receive = (event: MessageEvent<BrokerReply>) => {
      if (event.data.requestId !== requestId) return
      broker.port.removeEventListener("message", receive)
      if (event.data.type === "module-error") {
        reject(new Error(event.data.message ?? "WASM compile failed"))
      } else {
        resolve(event.data)
      }
    }
    broker.port.addEventListener("message", receive)
    broker.port.start()
    broker.port.postMessage({ type, requestId, ...values })
  })
}

async function report(
  broker: WorkerBroker,
  type: EngineEventType,
  moduleKey: string,
  instanceId?: string,
) {
  await sendRequest(broker, "record-event", {
    event: { type, workerId: broker.workerId, moduleKey, instanceId },
  })
}

function discardBroker(broker: WorkerBroker) {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__
  if (!state) return
  state.brokers = state.brokers.filter(({ port }) => port !== broker.port)
  broker.port.postMessage({
    type: "release-broker",
    workerId: broker.workerId,
  })
  broker.port.close()
}

const factory = stockFactory as EmscriptenFactory

export default async function createWaSqliteModule(): Promise<unknown> {
  const state = globalThis.__CVC_ENGINE_WORKER_STATE__
  const broker = state?.brokers.at(-1)
  if (!state || !broker) return factory()

  const moduleKey = new URL(wasmUrl, self.location.href).href
  const instanceId = `${broker.workerId}-instance-${++state.instanceSequence}`
  let module: WebAssembly.Module | undefined

  try {
    const response = await sendRequest(broker, "request-module", {
      moduleKey,
      moduleUrl: moduleKey,
    })
    if (response.type === "module-fallback") {
      // The page records `fallback` before sending this response.
      const fallbackModule = await factory()
      await report(broker, "instance-created", moduleKey, instanceId)
      return fallbackModule
    }
    if (response.type !== "compiled-module" || !response.module) {
      throw new Error(
        "The startup broker returned no compiled WebAssembly.Module",
      )
    }
    module = response.module

    const freshInstanceFactory = async () =>
      factory({
        instantiateWasm(imports, receiveInstance) {
          const instance = new WebAssembly.Instance(module!, imports)
          receiveInstance(instance, module!)
          return instance.exports
        },
      })

    const freshModule = await freshInstanceFactory()
    await report(broker, "instance-created", moduleKey, instanceId)
    return freshModule
  } catch (error) {
    await report(broker, "error", moduleKey, instanceId).catch(() => undefined)
    throw error
  } finally {
    discardBroker(broker)
  }
}
