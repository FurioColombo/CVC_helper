// Compile code only: database instances, memory and VFS remain in fresh SDK
// workers. The page terminates this worker on completion, failure or timeout.
self.addEventListener(
  "message",
  async (event: MessageEvent<unknown>) => {
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
      const module = await WebAssembly.compileStreaming(fetch(url.href))
      self.postMessage({ type: "compiled", module })
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
