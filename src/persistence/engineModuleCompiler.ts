// Compile code only: database instances, memory and VFS remain in fresh SDK
// workers. The page terminates this worker on completion, failure or timeout.
type CompilerTimings = {
  workerModuleEnteredAt: number
  workerRequestReceivedAt: number
  workerFetchStartedAt: number
  workerResponseHeadersAt: number
  workerCompileCalledAt: number
  workerCompiledAt: number
  workerReplySentAt: number
}

const COMPILER_TIMING_KEYS = [
  "workerModuleEnteredAt",
  "workerRequestReceivedAt",
  "workerFetchStartedAt",
  "workerResponseHeadersAt",
  "workerCompileCalledAt",
  "workerCompiledAt",
  "workerReplySentAt",
] as const satisfies readonly (keyof CompilerTimings)[]

function isCompilerTimings(
  value: Partial<CompilerTimings>,
): value is CompilerTimings {
  return COMPILER_TIMING_KEYS.every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  )
}

const diagnosticsEnabled = import.meta.env.DEV
const workerModuleEnteredAt = diagnosticsEnabled
  ? performance.timeOrigin + performance.now()
  : undefined

self.addEventListener(
  "message",
  async (event: MessageEvent<unknown>) => {
    const workerRequestReceivedAt = diagnosticsEnabled
      ? performance.timeOrigin + performance.now()
      : undefined
    try {
      const request = event.data
      if (
        typeof request !== "object" ||
        request === null ||
        !("type" in request) ||
        request.type !== "compile-module" ||
        !("moduleUrl" in request) ||
        typeof request.moduleUrl !== "string"
      ) {
        throw new Error("Invalid PowerSync compilation request")
      }
      const url = new URL(request.moduleUrl)
      if (url.origin !== self.location.origin) {
        throw new Error("Unexpected PowerSync compiler asset URL")
      }

      const timings: Partial<CompilerTimings> | undefined =
        diagnosticsEnabled &&
        workerModuleEnteredAt !== undefined &&
        workerRequestReceivedAt !== undefined
          ? {
              workerModuleEnteredAt,
              workerRequestReceivedAt,
              workerFetchStartedAt: performance.timeOrigin + performance.now(),
            }
          : undefined
      const response = await fetch(url.href)
      if (timings) {
        timings.workerResponseHeadersAt =
          performance.timeOrigin + performance.now()
      }
      const mimeType = response.headers
        .get("Content-Type")
        ?.replace(/^[\t ]+|[\t ]+$/g, "")
      const expectedMimeType = "application/wasm"
      const hasExpectedMimeType =
        mimeType !== undefined &&
        mimeType.length === expectedMimeType.length &&
        [...mimeType].every((character, index) => {
          const code = character.charCodeAt(0)
          const asciiLowercase =
            code >= 65 && code <= 90
              ? String.fromCharCode(code + 32)
              : character
          return asciiLowercase === expectedMimeType[index]
        })
      if (!response.ok || !hasExpectedMimeType) {
        throw new Error(
          "PowerSync WASM response does not meet compileStreaming requirements",
        )
      }
      const buffer = await response.arrayBuffer()
      if (timings) {
        timings.workerCompileCalledAt =
          performance.timeOrigin + performance.now()
      }
      const module = new WebAssembly.Module(buffer)
      if (timings) {
        timings.workerCompiledAt = performance.timeOrigin + performance.now()
        timings.workerReplySentAt = performance.timeOrigin + performance.now()
      }
      self.postMessage({
        type: "compiled",
        module,
        ...(timings && isCompilerTimings(timings) ? { timings } : {}),
      })
    } catch (error) {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  },
  { once: true },
)

export {}
