import { readFile } from "node:fs/promises"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const LOCAL_OCR_ASSETS = {
  "/ocr/worker.min.js": "node_modules/tesseract.js/dist/worker.min.js",
  "/ocr/lang/ita.traineddata.gz":
    "node_modules/@tesseract.js-data/ita/4.0.0_best_int/ita.traineddata.gz",
  "/ocr/core/tesseract-core-lstm.wasm.js":
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "/ocr/core/tesseract-core-simd-lstm.wasm.js":
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js":
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
} as const

function localOcrAssets(): Plugin {
  return {
    name: "local-ocr-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://cvc-helper.local")
          .pathname as keyof typeof LOCAL_OCR_ASSETS
        const relativePath = LOCAL_OCR_ASSETS[pathname]
        if (!relativePath) return next()

        void readFile(path.resolve(import.meta.dirname, relativePath))
          .then((contents) => {
            response.statusCode = 200
            response.setHeader(
              "Content-Type",
              pathname.endsWith(".wasm")
                ? "application/wasm"
                : pathname.endsWith(".gz")
                  ? "application/gzip"
                  : "text/javascript; charset=utf-8",
            )
            response.end(contents)
          })
          .catch(next)
      })
    },
    async buildStart() {
      for (const [urlPath, relativePath] of Object.entries(LOCAL_OCR_ASSETS)) {
        this.emitFile({
          type: "asset",
          fileName: urlPath.slice(1),
          source: await readFile(
            path.resolve(import.meta.dirname, relativePath),
          ),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localOcrAssets(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "CVC Helper",
        short_name: "CVC Helper",
        description: "Supporto operativo locale per una settimana CVC Caprera.",
        theme_color: "#063b52",
        background_color: "#f4f1e8",
        display: "standalone",
        start_url: "/",
        lang: "it",
        icons: [
          {
            src: "/icons/cvc-helper-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/cvc-helper-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,woff2}"],
        globIgnores: ["**/ort-wasm-*.wasm", "ocr/**"],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          {
            urlPattern: /\/ocr\//,
            handler: "CacheFirst",
            options: {
              cacheName: "cvc-ocr-runtime",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /\/assets\/ort-wasm-.*\.wasm$/,
            handler: "CacheFirst",
            options: {
              cacheName: "cvc-speech-runtime",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
})
