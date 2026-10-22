import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearDb } from "../support/db"
import { jsonResponse, stubFetch } from "../support/fetch"

let i18n
let dbModule

// i18n memoizes the loaded translations at module level, so each test needs a
// fresh copy (and the lib/db instance that copy imports).
beforeEach(async () => {
  vi.resetModules()
  dbModule = await import("lib/db")
  i18n = await import("lib/i18n")
  await clearDb(dbModule.db)
  document.documentElement.lang = "es"
})

afterEach(() => {
  document.documentElement.lang = ""
})

describe("locale", () => {
  it("reads the document language and defaults to en", () => {
    expect(i18n.locale()).toBe("es")

    document.documentElement.lang = ""

    expect(i18n.locale()).toBe("en")
  })
})

describe("load", () => {
  it("uses the IndexedDB copy without hitting the network", async () => {
    await dbModule.putLocale("es", { hello: "Hola" }, "v1")
    const fetch = stubFetch()

    expect(await i18n.load()).toEqual({ hello: "Hola" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fetches and stores the locale on a first-ever visit", async () => {
    const fetch = stubFetch(async () => jsonResponse({ hello: "Hola" }))

    expect(await i18n.load()).toEqual({ hello: "Hola" })
    expect(fetch).toHaveBeenCalledWith("/translations/es")
    expect(await dbModule.getLocale("es")).toEqual({ locale: "es", translations: { hello: "Hola" }, fingerprint: null })
  })

  it("throws when the network fallback fails", async () => {
    stubFetch(async () => jsonResponse({}, 500))

    await expect(i18n.load()).rejects.toThrow("translations fetch failed: 500")
  })

  it("re-reads IndexedDB on every load so a locale refreshed in the background takes effect", async () => {
    await dbModule.putLocale("es", { hello: "Hola" }, "v1")
    const fetch = stubFetch()
    await i18n.load()
    await dbModule.putLocale("es", { hello: "Hola de nuevo" }, "v2")

    expect(await i18n.load()).toEqual({ hello: "Hola de nuevo" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reloads when the document language changes", async () => {
    await dbModule.putLocale("es", { hello: "Hola" }, "v1")
    await dbModule.putLocale("en", { hello: "Hello" }, "v1")
    await i18n.load()

    document.documentElement.lang = "en"

    expect(await i18n.load()).toEqual({ hello: "Hello" })
    expect(i18n.t("hello")).toBe("Hello")
  })
})

describe("t", () => {
  beforeEach(async () => {
    await dbModule.putLocale("es", { greeting: "Hola %{name}, %{name}!", plain: "Sin datos" }, "v1")
  })

  it("returns the key before translations are loaded", () => {
    expect(i18n.t("plain")).toBe("plain")
  })

  it("translates and interpolates every occurrence of a placeholder", async () => {
    await i18n.load()

    expect(i18n.t("plain")).toBe("Sin datos")
    expect(i18n.t("greeting", { name: "Ana" })).toBe("Hola Ana, Ana!")
  })

  it("falls back to the key for a missing translation", async () => {
    await i18n.load()

    expect(i18n.t("missing.key")).toBe("missing.key")
  })
})
