import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, getConfig, getLocale, putConfig, putLocale } from "lib/db"
import {
  cachedConfig, coreIndicators, dimensionIndicators, extensionIndicators, refresh
} from "lib/config_cache"
import { clearDb } from "../support/db"
import { jsonResponse, stubFetch } from "../support/fetch"

beforeEach(() => clearDb(db))

function questionnaireServer(config, translations = { en: { hello: "Hello" }, es: { hello: "Hola" } }) {
  return stubFetch(async (url) => {
    if (url === "/api/questionnaire") return jsonResponse(config)
    const locale = url.split("/").pop()
    return jsonResponse(translations[locale])
  })
}

describe("cachedConfig", () => {
  it("returns the cached config without touching the network", async () => {
    await putConfig({ fingerprint: "v1", indicators: [] })
    const fetch = stubFetch()

    expect(await cachedConfig()).toMatchObject({ fingerprint: "v1" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fetches and caches the config on a miss", async () => {
    questionnaireServer({ fingerprint: "v1", indicators: [{ key: "a" }] })

    expect(await cachedConfig()).toEqual({ id: "core", fingerprint: "v1", indicators: [{ key: "a" }] })
    expect(await getConfig()).toMatchObject({ fingerprint: "v1" })
  })
})

describe("refresh", () => {
  it("rewrites config and both locales when the fingerprint changes", async () => {
    await putConfig({ fingerprint: "v1", indicators: [] })
    questionnaireServer({ fingerprint: "v2", indicators: [{ key: "a" }] })

    expect(await refresh()).toMatchObject({ fingerprint: "v2", indicators: [{ key: "a" }] })
    expect(await getLocale("en")).toEqual({ locale: "en", translations: { hello: "Hello" }, fingerprint: "v2" })
    expect(await getLocale("es")).toEqual({ locale: "es", translations: { hello: "Hola" }, fingerprint: "v2" })
  })

  it("keeps the cache untouched when the fingerprint is unchanged", async () => {
    await putConfig({ fingerprint: "v1", indicators: [] })
    await putLocale("en", { hello: "Cached" }, "v1")
    const fetch = questionnaireServer({ fingerprint: "v1", indicators: [{ key: "ignored" }] })

    expect(await refresh()).toMatchObject({ indicators: [] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await getLocale("en")).translations).toEqual({ hello: "Cached" })
  })

  it("keeps the existing translation when one locale fails to download", async () => {
    await putLocale("es", { hello: "Cached" }, "v1")
    stubFetch(async (url) => {
      if (url === "/api/questionnaire") return jsonResponse({ fingerprint: "v2" })
      if (url.endsWith("/es")) throw new TypeError("Failed to fetch")
      return jsonResponse({ hello: "Hello" })
    })

    await refresh()

    expect((await getLocale("en")).translations).toEqual({ hello: "Hello" })
    expect(await getLocale("es")).toMatchObject({ translations: { hello: "Cached" }, fingerprint: "v1" })
  })

  it("falls back to the cache when offline, on an error response, or on a network error", async () => {
    await putConfig({ fingerprint: "v1" })

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const offlineFetch = stubFetch()
    expect(await refresh()).toMatchObject({ fingerprint: "v1" })
    expect(offlineFetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()

    stubFetch(async () => jsonResponse({}, 503))
    expect(await refresh()).toMatchObject({ fingerprint: "v1" })

    stubFetch(async () => { throw new TypeError("Failed to fetch") })
    expect(await refresh()).toMatchObject({ fingerprint: "v1" })
  })
})

describe("indicator helpers", () => {
  const config = {
    indicators: [
      { key: "a", dimension: "soil" },
      { key: "b", dimension: "water" },
      { key: "c", dimension: "soil" }
    ],
    extensions: { andes: { indicators: [{ key: "x" }] }, coast: {} }
  }

  it("filters core indicators by dimension", () => {
    expect(dimensionIndicators(config, "soil").map((indicator) => indicator.key)).toEqual(["a", "c"])
    expect(coreIndicators({})).toEqual([])
  })

  it("returns the territory's extension indicators and an empty list when there are none", () => {
    expect(extensionIndicators(config, "andes")).toEqual([{ key: "x" }])
    expect(extensionIndicators(config, "coast")).toEqual([])
    expect(extensionIndicators(config, "unknown")).toEqual([])
    expect(extensionIndicators(config, null)).toEqual([])
    expect(extensionIndicators({}, "andes")).toEqual([])
  })
})
