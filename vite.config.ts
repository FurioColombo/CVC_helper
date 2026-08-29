import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,woff2}"],
        globIgnores: ["**/ort-wasm-*.wasm"],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
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
