import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
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

// Where the app will be served from. `/` for a host that gives it the root of a
// domain; `/<repo>/` for a project host that serves it from a subdirectory.
// V01 measured that the app needs no cross-origin isolation, so any static host
// will do — but only if its base path reaches the assets, which is what this is
// for. Set CVC_BASE_PATH at build time; the default changes nothing.
const base = (() => {
  const configured = process.env.CVC_BASE_PATH?.trim()
  if (!configured || configured === "/") return "/"
  return `/${configured.replace(/^\/+|\/+$/g, "")}/`
})()

// The Home header's CVC mark (`CvcMark.tsx`) renders on first paint, on every
// screen the router can land on cold, so it has to survive an offline cold
// start the same way the OCR/speech runtime assets do. It is deliberately
// the only PNG added here — `globPatterns` below excludes images on purpose
// so the seven boat marks (rendered only once a course/boat screen is open,
// never at startup) do not balloon the install precache. The revision is a
// content hash rather than `null` because this file, unlike a hashed
// `dist/assets/*` chunk, keeps its literal filename across builds.
const BRAND_STARTUP_IMAGES = ["brand/cvc-symbol.png"] as const

function brandStartupManifestEntries() {
  return BRAND_STARTUP_IMAGES.map((relativePath) => {
    const contents = readFileSync(
      path.resolve(import.meta.dirname, "public", relativePath),
    )
    return {
      url: relativePath,
      revision: createHash("sha256").update(contents).digest("hex"),
    }
  })
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    localOcrAssets(),
    VitePWA({
      // "autoUpdate" swaps the service worker and reloads the page the moment
      // a new version activates, with no chance for the instructor to finish
      // whatever they were doing first. A reload mid-scan-review or mid-note
      // would discard it. "prompt" leaves the current tab alone until
      // `UpdateAvailableBanner` (mounted from `src/main.tsx`) asks and the
      // instructor taps Aggiorna.
      registerType: "prompt",
      manifest: {
        name: "CVC Helper",
        short_name: "CVC Helper",
        description: "Supporto operativo locale per una settimana CVC Caprera.",
        theme_color: "#2f5fa0",
        // Matches `--background` in src/styles.css — checked by
        // scripts/check-built-pwa.mjs so the two cannot drift again the way
        // this cream value drifted from the app's actual surface colour.
        background_color: "#f2f6fb",
        display: "standalone",
        // An installed PWA navigates to these itself, so they have to carry the
        // base path rather than assume the origin root.
        start_url: base,
        scope: base,
        id: base,
        lang: "it",
        icons: [
          {
            src: `${base}icons/cvc-helper-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base}icons/cvc-helper-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // OCR is a first-use capability. Keep every local worker, language
        // model and core variant in the install precache so a newly installed
        // app can scan its first roster without a network round trip.
        globPatterns: ["**/*.{js,css,html,wasm,woff2,gz}"],
        globIgnores: ["**/ort-wasm-*.wasm"],
        // The largest local OCR core is ~3.9 MB. Keep a small margin while
        // still making unexpectedly large assets visible in the build.
        maximumFileSizeToCacheInBytes: 4_500_000,
        // Precached explicitly rather than by extension: see
        // `brandStartupManifestEntries` above for why only this one PNG.
        additionalManifestEntries: brandStartupManifestEntries(),
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
            // Covers both the .wasm binary and its .mjs loader factory — the
            // local onnxruntime-web runtime `configureLocalOnnxRuntime` in
            // src/capabilities/speech.ts points at, in place of the
            // cdn.jsdelivr.net default transformers.js would otherwise fetch.
            urlPattern: /\/assets\/ort-wasm-.*\.(?:wasm|mjs)$/,
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
