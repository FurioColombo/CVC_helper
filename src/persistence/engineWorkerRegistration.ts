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
  state.brokers.push({
    workerId: registration.workerId,
    port: registration.port,
  })
}

self.addEventListener("message", receiveDedicatedRegistration)

export {}
