import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Build stamp: baked in at build time so both the app UI and the page HTML
// reflect exactly which build is deployed (helps diagnose stale caches).
const BUILD = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: {
    rollupOptions: {
      output: {
        // Keep rarely-changing libraries in their own long-cached chunk.
        manualChunks: { vendor: ["react", "react-dom", "@supabase/supabase-js"] },
      },
    },
  },
  plugins: [
    {
      name: "build-stamp-meta",
      transformIndexHtml(html) {
        return html
          .replace(/(<meta name="description" content=")([^"]*)("\s*\/?>)/, "$1$2 \u00b7 build " + BUILD + "$3")
          .replace("</head>", '  <meta name="build" content="' + BUILD + '">\n</head>');
      },
    },
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png", "favicon-32.png", "icon.svg"],
      manifest: {
        name: "Avalanche Safety Training Prep",
        short_name: "AST Prep",
        description: "Practice tools for Avalanche Skills Training — slope angle, danger rating, terrain traps, beacon search, and AST 1/2 exams. Works offline.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1720",
        theme_color: "#0f1720",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        // Don't let the SPA fallback hijack navigations to real static files
        // (e.g. opening a PDF in a new tab) — let those hit the network so the
        // file in /public is served instead of the app shell.
        navigateFallbackDenylist: [/\.pdf$/i, /\.(png|jpe?g|svg|ico|txt|csv|xlsx|zip|woff2?)$/i],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 3145728
      }
    })
  ]
});
