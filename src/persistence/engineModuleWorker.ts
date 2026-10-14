import "../../node_modules/@powersync/web/lib/worker/worker.js"

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

type SharedConnectEvent = MessageEvent & { ports: MessagePort[] }
type SharedScope = typeof self & {
  onconnect?: ((event: SharedConnectEvent) => void) | null
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

function registerBroker(message: BrokerRegistration) {
  message.port.start()
  state.brokers.push({ workerId: message.workerId, port: message.port })
}

function receiveDedicatedRegistration(event: MessageEvent<BrokerRegistration>) {
  if (event.data?.type !== "cvc-engine-broker-port") return
  event.stopImmediatePropagation()
  registerBroker(event.data)
}

const sharedScope = self as SharedScope
if ("onconnect" in self) {
  const sdkOnConnect = sharedScope.onconnect
  sharedScope.onconnect = (event) => {
    const outerPort = event.ports[0]
    if (!outerPort) return
    outerPort.addEventListener(
      "message",
      (messageEvent: MessageEvent<BrokerRegistration>) => {
        const registration = messageEvent.data
        if (registration?.type === "cvc-engine-broker-port") {
          // The pinned SDK handler ignores this private service tag; it still
          // handles its normal `database` handshake on the same outer port.
          registerBroker(registration)
        }
      },
    )
    outerPort.start()
    sdkOnConnect?.call(sharedScope, event)
  }
} else {
  self.addEventListener("message", receiveDedicatedRegistration)
}
