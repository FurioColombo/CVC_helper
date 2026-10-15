type BrokerRegistration = {
  type: "cvc-engine-broker-port"
  workerId: string
  port: MessagePort
}

type WorkerBroker = {
  workerId: string
  port: MessagePort
}

type WorkerState = {
  brokers: WorkerBroker[]
  requestSequence: number
  instanceSequence: number
}

declare global {
  var __CVC_ENGINE_WORKER_STATE__: WorkerState | undefined
}

console.info(
  "D3 registration evaluation",
  Boolean(globalThis.__CVC_ENGINE_WORKER_STATE__),
  globalThis.__CVC_ENGINE_WORKER_STATE__?.brokers.length,
)
const state: WorkerState = {
  brokers: [],
  requestSequence: 0,
  instanceSequence: 0,
}
globalThis.__CVC_ENGINE_WORKER_STATE__ = state

function receiveDedicatedRegistration(event: MessageEvent<BrokerRegistration>) {
  const registration = event.data
  if (
    registration?.type !== "cvc-engine-broker-port" ||
    typeof registration.workerId !== "string" ||
    !registration.port
  ) {
    return
  }

  // Consume the private message before the pinned SDK installs its own handler.
  event.stopImmediatePropagation()
  registration.port.start()
  console.info(
    "D3 broker received",
    registration.workerId,
    state.brokers.length,
  )
  state.brokers.push({
    workerId: registration.workerId,
    port: registration.port,
  })
}

self.addEventListener("message", receiveDedicatedRegistration)

export {}
