import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const APP_ORIGIN = "https://cvc-helper.test"
const MODULE_URL = `${APP_ORIGIN}/assets/sqlite.wasm`
const VALID_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])

type CompilerReply =
  | {
      type: "compiled"
      module: WebAssembly.Module
      timings?: Record<string, number>
    }
  | { type: "error"; message: string }

type CompilerMessageHandler = (event: MessageEvent<unknown>) => Promise<void>

let handler: CompilerMessageHandler | undefined
let replies: CompilerReply[]
let workerScope: {
  location: { origin: string }
  addEventListener: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  handler = undefined
  replies = []
  workerScope = {
    location: { origin: APP_ORIGIN },
    addEventListener: vi.fn((type, listener) => {
      if (type === "message") {
        handler = listener as CompilerMessageHandler
      }
    }),
    postMessage: vi.fn((reply: CompilerReply) => replies.push(reply)),
  }
  vi.stubGlobal("self", workerScope)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function compile(moduleUrl = MODULE_URL) {
  vi.resetModules()
  await import("./engineModuleCompiler")
  if (!handler)
    throw new Error("Compiler worker did not register its message handler")
  await handler({
    data: { type: "compile-module", moduleUrl },
  } as MessageEvent<unknown>)
  const reply = replies[0]
  if (!reply) throw new Error("Compiler worker did not reply")
  return reply
}

function wasmResponse(
  status = 200,
  contentType: string | null = "application/wasm",
  body = VALID_WASM,
) {
  return new Response(body, {
    status,
    headers: contentType === null ? {} : { "Content-Type": contentType },
  })
}

describe("PowerSync engine module compiler", () => {
  it("compiles a valid same-origin WASM response and returns development timings", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(wasmResponse(200, "APPLICATION/WASM"))
    vi.stubGlobal("fetch", fetchMock)

    const reply = await compile()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(MODULE_URL)
    expect(reply.type).toBe("compiled")
    if (reply.type !== "compiled") throw new Error("Expected a compiled reply")
    expect(reply.module).toBeInstanceOf(WebAssembly.Module)
    expect(reply.timings).toBeDefined()
    expect(Object.keys(reply.timings ?? {}).sort()).toEqual(
      [
        "workerModuleEnteredAt",
        "workerRequestReceivedAt",
        "workerFetchStartedAt",
        "workerResponseHeadersAt",
        "workerCompileCalledAt",
        "workerCompiledAt",
        "workerReplySentAt",
      ].sort(),
    )
    for (const timestamp of Object.values(reply.timings ?? {})) {
      expect(Number.isFinite(timestamp)).toBe(true)
    }
    expect(workerScope.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
      { once: true },
    )
  })

  it.each([
    [404, "application/wasm"],
    [200, "application/wasm; charset=utf-8"],
    [200, "text/plain"],
    [200, null],
  ])(
    "rejects HTTP status %i with content type %s before constructing a module",
    async (status, contentType) => {
      const moduleConstructor = vi.spyOn(WebAssembly, "Module")
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(wasmResponse(status, contentType))
      vi.stubGlobal("fetch", fetchMock)

      const reply = await compile()

      expect(reply).toMatchObject({
        type: "error",
        message:
          "PowerSync WASM response does not meet compileStreaming requirements",
      })
      expect(moduleConstructor).not.toHaveBeenCalled()
    },
  )

  it("rejects an external module URL without fetching it", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)

    const reply = await compile("https://another-origin.test/sqlite.wasm")

    expect(reply).toMatchObject({
      type: "error",
      message: "Unexpected PowerSync compiler asset URL",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports invalid WASM bytes as a compiler error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        wasmResponse(200, "application/wasm", new Uint8Array([1, 2, 3])),
      )
    vi.stubGlobal("fetch", fetchMock)

    const reply = await compile()

    expect(reply.type).toBe("error")
    if (reply.type !== "error")
      throw new Error("Expected a compiler error reply")
    expect(reply.message).toMatch(/WebAssembly\.Module/)
  })
})
