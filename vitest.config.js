import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

// Mirrors config/importmap.rb so app code imports resolve the same way under
// test. dexie points at the vendored copy to exercise the exact pinned build.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^lib\//, replacement: path("./app/javascript/lib/") },
      { find: /^controllers\//, replacement: path("./app/javascript/controllers/") },
      { find: /^dexie$/, replacement: path("./vendor/javascript/dexie.js") },
      { find: /^chart\.js$/, replacement: path("./vendor/javascript/chart.umd.js") }
    ]
  },
  test: {
    environment: "jsdom",
    include: ["spec/javascript/**/*.test.js"],
    setupFiles: ["spec/javascript/setup.js"],
    restoreMocks: true,
    unstubGlobals: true
  }
})
