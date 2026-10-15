// Diagnostic only: compile immutable code; no SDK, database, instance or VFS.
self.addEventListener(
  "message",
  async (event: MessageEvent<{ moduleUrl: string }>) => {
    try {
      const url = new URL(event.data.moduleUrl)
      if (url.origin !== self.location.origin)
        throw new Error("Unexpected compiler URL")
      const module = await WebAssembly.compileStreaming(fetch(url))
      self.postMessage({ type: "compiled", module })
    } catch (error) {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
