import { MessageChannel as NodeMessageChannel } from "node:worker_threads"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineStartupWorkerScope } from "./engineModuleBroker"

const APP_ORIGIN = "https://cvc-helper.test"

type CompilerMode =
  | "success"
  | "compile-error"
  | "worker-error"
  | "messageerror"
  | "malformed"
  | "post-message-error"
  | "constructor-error"
  | "timeout"

type StartupScope = ReturnType<typeof createEngineStartupWorkerScope>
type CompiledReply = { type: string; module: WebAssembly.Module }
type CompilerTimings = {
  workerModuleEnteredAt: number
  workerRequestReceivedAt: number
  workerFetchStartedAt: number
  workerResponseHeadersAt: number
  workerCompileCalledAt: number
  workerCompiledAt: number
  workerReplySentAt: number
}

type StartupMessage = {
  type?: string
  workerId?: string
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function eventWithMessage(type: string, message: string) {
  const event = new Event(type)
  Object.defineProperty(event, "message", { value: message })
  return event
}

let compilerModes: CompilerMode[] = []
let compilerAttempts = 0
let compilerWorkers: FakeWorker[] = []
let sdkWorkers: FakeWorker[] = []
let compilerWaiters = new Map<number, Deferred<FakeWorker>>()
let scopes: StartupScope[] = []
let assetSequence = 0

function waitForCompiler(index: number) {
  const existing = compilerWorkers[index]
  if (existing) return Promise.resolve(existing)

  const waiter = deferred<FakeWorker>()
  compilerWaiters.set(index, waiter)
  return waiter.promise
}

class FakeWorker {
  readonly scriptUrl: string
  readonly compilerMode: CompilerMode | undefined
  readonly listeners = new Map<string, Set<EventListener>>()
  brokerPort: InstanceType<typeof NodeMessageChannel>["port1"] | undefined
  workerId: string | undefined
  terminated = false
  postMessageCalls = 0

  constructor(script: string | URL) {
    this.scriptUrl = String(script)
    if (this.scriptUrl.includes("engineModuleCompiler")) {
      compilerAttempts += 1
      const mode = compilerModes.shift() ?? "success"
      if (mode === "constructor-error") {
        throw new Error("compiler worker constructor failed")
      }
      this.compilerMode = mode
      const index = compilerWorkers.push(this) - 1
      compilerWaiters.get(index)?.resolve(this)
      compilerWaiters.delete(index)
    } else {
      sdkWorkers.push(this)
      this.compilerMode = undefined
    }
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: unknown, transfer?: readonly unknown[]) {
    this.postMessageCalls += 1
    if (this.compilerMode) {
      this.postCompilerRequest()
      return
    }

    const startup = message as StartupMessage
    this.workerId = startup.workerId
    this.brokerPort = transfer?.[0] as
      InstanceType<typeof NodeMessageChannel>["port1"] | undefined
  }

  private postCompilerRequest() {
    if (this.compilerMode === "post-message-error") {
      throw new Error("compiler worker postMessage failed")
    }

    switch (this.compilerMode) {
      case "compile-error":
        queueMicrotask(() =>
          this.emit(
            "message",
            new MessageEvent("message", {
              data: { type: "error", message: "WASM compilation failed" },
            }),
          ),
        )
        break
      case "worker-error":
        queueMicrotask(() =>
          this.emit(
            "error",
            eventWithMessage("error", "compiler worker failed"),
          ),
        )
        break
      case "messageerror":
        queueMicrotask(() =>
          this.emit("messageerror", new Event("messageerror")),
        )
        break
      case "malformed":
        queueMicrotask(() =>
          this.emit(
            "message",
            new MessageEvent("message", { data: { type: "not-compiled" } }),
          ),
        )
        break
      case "success":
      case "timeout":
        break
    }
  }

  publishModule(module: WebAssembly.Module, timings?: unknown) {
    this.emit(
      "message",
      new MessageEvent("message", {
        data: { type: "compiled", module, ...(timings ? { timings } : {}) },
      }),
    )
  }

  terminate() {
    this.terminated = true
  }

  listenerCount() {
    let count = 0
    for (const listeners of this.listeners.values()) count += listeners.size
    return count
  }

  private emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function makeScope() {
  const scope = createEngineStartupWorkerScope()
  scopes.push(scope)
  return scope
}

function makeSdkWorker(scope: StartupScope) {
  return scope.createWorker({
    dbFilename: `broker-test-${sdkWorkers.length}`,
    vfs: "IDBBatchAtomicVFS",
    encryptionKey: undefined,
    useWebWorker: true,
    enableMultiTabs: false,
  } as Parameters<StartupScope["createWorker"]>[0]) as unknown as FakeWorker
}

function moduleAsset() {
  assetSequence += 1
  return `${APP_ORIGIN}/assets/broker-test-${assetSequence}.wasm`
}

function receiveNext(port: NonNullable<FakeWorker["brokerPort"]>) {
  return new Promise<unknown>((resolve) => {
    port.once("message", resolve)
    port.start()
  })
}

function requestModule(
  worker: FakeWorker,
  moduleUrl: string,
  moduleKey = moduleUrl,
) {
  const port = worker.brokerPort
  if (!port) throw new Error("The fake SDK worker has no broker port")

  const reply = receiveNext(port)
  port.postMessage({
    type: "request-module",
    requestId: `request-${worker.workerId}`,
    workerId: worker.workerId,
    moduleKey,
    moduleUrl,
  })
  return reply
}

async function releaseBrokerPort(worker: FakeWorker) {
  const port = worker.brokerPort
  if (!port || !worker.workerId) return
  const closed = new Promise<void>((resolve) => port.once("close", resolve))
  port.postMessage({ type: "release-broker", workerId: worker.workerId })
  await closed
}

function validModule() {
  return new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
}

function validCompilerTimings(): CompilerTimings {
  const start = performance.timeOrigin + performance.now()
  return {
    workerModuleEnteredAt: start,
    workerRequestReceivedAt: start + 1,
    workerFetchStartedAt: start + 2,
    workerResponseHeadersAt: start + 3,
    workerCompileCalledAt: start + 4,
    workerCompiledAt: start + 5,
    workerReplySentAt: start + 6,
  }
}

beforeEach(() => {
  compilerModes = []
  compilerAttempts = 0
  compilerWorkers = []
  sdkWorkers = []
  compilerWaiters = new Map()
  scopes = []
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  vi.stubGlobal("window", {
    location: new URL(`${APP_ORIGIN}/`),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    __CVC_ENGINE_DIAGNOSTIC__: [],
  })
  vi.stubGlobal("Worker", FakeWorker)
  vi.stubGlobal("MessageChannel", NodeMessageChannel)
})

afterEach(() => {
  for (const scope of scopes) scope.cleanupFailedInitialization()
  for (const worker of [...sdkWorkers, ...compilerWorkers]) {
    worker.terminate()
    worker.brokerPort?.close()
  }
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PowerSync engine module broker", () => {
  it("compiles once for concurrent opens and creates a fresh SDK worker for each", async () => {
    const scope = makeScope()
    const firstWorker = makeSdkWorker(scope)
    const secondWorker = makeSdkWorker(scope)
    const url = moduleAsset()
    const firstReply = requestModule(firstWorker, url)
    const secondReply = requestModule(secondWorker, url)
    const compiler = await waitForCompiler(0)

    compiler.publishModule(validModule())

    const [first, second] = (await Promise.all([firstReply, secondReply])) as [
      CompiledReply,
      CompiledReply,
    ]
    expect(compilerAttempts).toBe(1)
    expect(sdkWorkers).toHaveLength(2)
    expect(firstWorker).not.toBe(secondWorker)
    expect(first.type).toBe("compiled-module")
    expect(second.type).toBe("compiled-module")
    expect(first.module).toBeInstanceOf(WebAssembly.Module)
    expect(second.module).toBeInstanceOf(WebAssembly.Module)
    expect(compiler.terminated).toBe(true)
    expect(compiler.listenerCount()).toBe(0)

    await Promise.all([
      releaseBrokerPort(firstWorker),
      releaseBrokerPort(secondWorker),
    ])
    scope.release()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("attaches finite worker and parent phase timestamps to the compile event", async () => {
    const scope = makeScope()
    const worker = makeSdkWorker(scope)
    const reply = requestModule(worker, moduleAsset())
    const compiler = await waitForCompiler(0)
    const workerTimings = validCompilerTimings()

    compiler.publishModule(validModule(), workerTimings)
    expect(((await reply) as CompiledReply).type).toBe("compiled-module")

    const compileEvent = window.__CVC_ENGINE_DIAGNOSTIC__?.find(
      (event) => event.type === "compile-complete",
    )
    expect(compileEvent?.timings).toMatchObject(workerTimings)
    expect(compileEvent?.timings).toMatchObject({
      parentCompileStartedAt: expect.any(Number),
      parentWorkerCreateStartedAt: expect.any(Number),
      parentWorkerCreatedAt: expect.any(Number),
      parentRequestSentAt: expect.any(Number),
      parentReplyReceivedAt: expect.any(Number),
      parentModuleReturnedAt: expect.any(Number),
    })

    await releaseBrokerPort(worker)
    scope.release()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("omits malformed worker timing metadata while preserving the compiled module", async () => {
    const scope = makeScope()
    const worker = makeSdkWorker(scope)
    const reply = requestModule(worker, moduleAsset())
    const compiler = await waitForCompiler(0)

    compiler.publishModule(validModule(), {
      ...validCompilerTimings(),
      workerCompiledAt: Number.NaN,
    })

    const result = (await reply) as CompiledReply
    expect(result.type).toBe("compiled-module")
    expect(result.module).toBeInstanceOf(WebAssembly.Module)
    const compileEvent = window.__CVC_ENGINE_DIAGNOSTIC__?.find(
      (event) => event.type === "compile-complete",
    )
    expect(compileEvent).not.toHaveProperty("timings")

    await releaseBrokerPort(worker)
    scope.release()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps the shared compilation alive when one SDK consumer fails", async () => {
    const failedScope = makeScope()
    const survivingScope = makeScope()
    const failedConsumer = makeSdkWorker(failedScope)
    const survivingConsumer = makeSdkWorker(survivingScope)
    const url = moduleAsset()
    const survivingReply = requestModule(survivingConsumer, url)
    void requestModule(failedConsumer, url)
    const compiler = await waitForCompiler(0)

    failedScope.cleanupFailedInitialization()
    expect(failedConsumer.terminated).toBe(true)
    expect(survivingConsumer.terminated).toBe(false)
    expect(compiler.terminated).toBe(false)
    compiler.publishModule(validModule())

    const result = (await survivingReply) as {
      type: string
      module: WebAssembly.Module
    }
    expect(result.type).toBe("compiled-module")
    expect(result.module).toBeInstanceOf(WebAssembly.Module)
    expect(compilerAttempts).toBe(1)
    expect(compiler.terminated).toBe(true)
    expect(compiler.listenerCount()).toBe(0)
    await releaseBrokerPort(survivingConsumer)
    survivingScope.release()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ["compiler error reply", "compile-error"],
    ["compiler worker error", "worker-error"],
    ["compiler messageerror", "messageerror"],
    ["malformed compiler reply", "malformed"],
    ["compiler postMessage error", "post-message-error"],
    ["compiler worker constructor error", "constructor-error"],
  ] as const)(
    "evicts a failed %s result so the exact URL can be retried",
    async (_label, mode) => {
      compilerModes.push(mode, "success")
      const scope = makeScope()
      const url = moduleAsset()
      const failedWorker = makeSdkWorker(scope)
      const failedReply = (await requestModule(failedWorker, url)) as {
        type: string
        message: string
      }

      expect(failedReply.type).toBe("module-error")
      if (mode !== "constructor-error") {
        const failedCompiler = compilerWorkers[0]
        expect(failedCompiler?.terminated).toBe(true)
        expect(failedCompiler?.listenerCount()).toBe(0)
      }

      const retryWorker = makeSdkWorker(scope)
      const retryReply = requestModule(retryWorker, url)
      const retryCompiler = await waitForCompiler(compilerWorkers.length)
      retryCompiler.publishModule(validModule())
      const result = (await retryReply) as {
        type: string
        module: WebAssembly.Module
      }

      expect(result.type).toBe("compiled-module")
      expect(result.module).toBeInstanceOf(WebAssembly.Module)
      expect(compilerAttempts).toBe(2)
      expect(retryCompiler.terminated).toBe(true)
      expect(retryCompiler.listenerCount()).toBe(0)
      await Promise.all([
        releaseBrokerPort(failedWorker),
        releaseBrokerPort(retryWorker),
      ])
      scope.release()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it("settles a timed-out compile, terminates its worker, and retries the same URL", async () => {
    compilerModes.push("timeout", "success")
    const failedScope = makeScope()
    const url = moduleAsset()
    const failedWorker = makeSdkWorker(failedScope)
    const failedCompilerPromise = waitForCompiler(0)
    const startupFailure = failedScope.failure
    requestModule(failedWorker, url)
    const failedCompiler = await failedCompilerPromise

    await vi.advanceTimersByTimeAsync(30_000)
    expect(await startupFailure).toBeInstanceOf(Error)
    expect(failedCompiler.terminated).toBe(true)
    expect(failedCompiler.listenerCount()).toBe(0)

    const retryScope = makeScope()
    const retryWorker = makeSdkWorker(retryScope)
    const retryReply = requestModule(retryWorker, url)
    const retryCompiler = await waitForCompiler(1)
    retryCompiler.publishModule(validModule())
    const result = (await retryReply) as {
      type: string
      module: WebAssembly.Module
    }

    expect(result.type).toBe("compiled-module")
    expect(result.module).toBeInstanceOf(WebAssembly.Module)
    expect(compilerAttempts).toBe(2)
    expect(retryCompiler.terminated).toBe(true)
    await releaseBrokerPort(retryWorker)
    retryScope.release()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["mismatched-key", "cross-origin"])(
    "rejects an unexpected %s asset URL without starting a compiler worker",
    async (kind) => {
      const scope = makeScope()
      const worker = makeSdkWorker(scope)
      const requestedUrl =
        kind === "cross-origin"
          ? "https://another-origin.test/module.wasm"
          : moduleAsset()
      const reply = (await requestModule(
        worker,
        requestedUrl,
        kind === "cross-origin"
          ? requestedUrl
          : `${APP_ORIGIN}/assets/another-module.wasm`,
      )) as { type: string; message: string }

      expect(reply.type).toBe("module-error")
      expect(reply.message).toContain("unexpected WASM asset URL")
      expect(compilerAttempts).toBe(0)
      await releaseBrokerPort(worker)
      scope.release()
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})
