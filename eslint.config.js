import js from "@eslint/js"
import globals from "globals"

export default [
  {
    ignores: ["vendor/**", "public/**", "app/assets/builds/**", "coverage/**", "tmp/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["app/javascript/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, Turbo: "readonly" }
    }
  },
  {
    files: ["app/views/pwa/service-worker.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.serviceworker
    }
  },
  {
    files: ["spec/javascript/**/*.js", "*.config.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error"
    }
  }
]
