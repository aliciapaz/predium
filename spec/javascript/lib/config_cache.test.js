import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, getConfig, getLocale, getResponses, putConfig, putLocale, queueEntries, saveForm, saveResponse } from "lib/db"
import {
  cachedConfig, dimensionIndicators, principles, refresh, territoryIndicators, visibleDimensions
} from "lib/config_cache"
import { clearDb } from "../support/db"
import { jsonResponse, stubFetch } from "../support/fetch"

beforeEach(() => clearDb(db))

function questionnaireServer(config, translations = { en: { hello: "Hello" }, es: { hello: "Hola" } }) {
  return stubFetch(async (url) => {
    if (url.startsWith("/api/questionnaire")) return jsonResponse(config)
    const locale = url.split("/").pop().split("?")[0]
    return jsonResponse(translations[locale])
  })
}

describe("cachedConfig", () => {
  it("returns the cached config without touching the network", async () => {
    await putConfig({ fingerprint: "v1", principles: [] })
    const fetch = stubFetch()

    expect(await cachedConfig()).toMatchObject({ fingerprint: "v1" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fetches and caches the config on a miss", async () => {
    questionnaireServer({ fingerprint: "v1", principles: [{ key: "a" }] })

    expect(await cachedConfig()).toEqual({ id: "core", fingerprint: "v1", principles: [{ key: "a" }] })
    expect(await getConfig()).toMatchObject({ fingerprint: "v1" })
  })

  it("replaces a cached config from before principles existed", async () => {
    await putConfig({ fingerprint: "old", indicators: [] })
    questionnaireServer({ fingerprint: "v2", principles: [{ key: "a" }] })

    expect(await cachedConfig()).toMatchObject({ fingerprint: "v2", principles: [{ key: "a" }] })
  })

  it("returns nothing rather than an incompatible config it cannot replace", async () => {
    await putConfig({ fingerprint: "old", indicators: [] })
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    expect(await cachedConfig()).toBeNull()
  })
})

describe("refresh", () => {
  it("rewrites config and both locales when the fingerprint changes", async () => {
    await putConfig({ fingerprint: "v1", principles: [] })
    questionnaireServer({ fingerprint: "v2", principles: [{ key: "a" }] })

    expect(await refresh()).toMatchObject({ fingerprint: "v2", principles: [{ key: "a" }] })
    expect(await getLocale("en")).toEqual({ locale: "en", translations: { hello: "Hello" }, fingerprint: "v2" })
    expect(await getLocale("es")).toEqual({ locale: "es", translations: { hello: "Hola" }, fingerprint: "v2" })
  })

  it("drops draft answers the new config no longer allows for the form's territory and queues the form", async () => {
    await putConfig({ fingerprint: "v1", principles: [] })
    await saveForm({ client_id: "draft", state: "draft", territory_key: "andes" })
    await saveForm({ client_id: "done", state: "completed", territory_key: "andes" })
    for (const id of ["draft", "done"]) {
      await saveResponse(id, "diversity", 5)
      await saveResponse(id, "kept", 6, true)
      await saveResponse(id, "removed", 7, true)
    }
    questionnaireServer({
      fingerprint: "v2",
      principles: [{ key: "diversity" }],
      extensions: { andes: { indicators: [{ key: "kept" }] } }
    })

    await refresh()

    expect(await getResponses("draft")).toEqual({ diversity: 5, kept: 6 })
    expect(await getResponses("done")).toEqual({ diversity: 5, kept: 6, removed: 7 })
    expect((await queueEntries()).map((entry) => entry.form_client_id)).toEqual(["draft"])
  })

  it("keeps the cache untouched when the fingerprint is unchanged", async () => {
    await putConfig({ fingerprint: "v1", principles: [] })
    await putLocale("en", { hello: "Cached" }, "v1")
    await putLocale("es", { hello: "Guardado" }, "v1")
    const fetch = questionnaireServer({ fingerprint: "v1", principles: [{ key: "ignored" }] })

    expect(await refresh()).toMatchObject({ principles: [] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await getLocale("en")).translations).toEqual({ hello: "Cached" })
  })

  it("re-downloads a locale that missed the current fingerprint even when the config matches", async () => {
    await putConfig({ fingerprint: "v1", principles: [] })
    await putLocale("en", { hello: "Cached" }, "v1")
    await putLocale("es", { hello: "Viejo" }, "v0")
    const fetch = questionnaireServer({ fingerprint: "v1", principles: [] })

    await refresh()

    expect(fetch).toHaveBeenCalledWith("/translations/es?v=v1")
    expect(await getLocale("es")).toEqual({ locale: "es", translations: { hello: "Hola" }, fingerprint: "v1" })
    expect((await getLocale("en")).translations).toEqual({ hello: "Cached" })
  })

  it("keeps the existing translation when one locale fails to download", async () => {
    await putLocale("es", { hello: "Cached" }, "v1")
    stubFetch(async (url) => {
      if (url.startsWith("/api/questionnaire")) return jsonResponse({ fingerprint: "v2", principles: [] })
      if (url.startsWith("/translations/es")) throw new TypeError("Failed to fetch")
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
    principles: [{ key: "p" }],
    dimensions: [{ key: "soil" }, { key: "water" }, { key: "air" }],
    extensions: {
      andes: {
        indicators: [
          { key: "a", dimension: "soil" },
          { key: "b", dimension: "water" },
          { key: "c", dimension: "soil" }
        ]
      },
      coast: {}
    }
  }

  it("returns the principles, or none for a config without them", () => {
    expect(principles(config)).toEqual([{ key: "p" }])
    expect(principles({})).toEqual([])
  })

  it("returns the territory's resolved indicators and an empty list when there are none", () => {
    expect(territoryIndicators(config, "andes").map((indicator) => indicator.key)).toEqual(["a", "b", "c"])
    expect(territoryIndicators(config, "coast")).toEqual([])
    expect(territoryIndicators(config, "unknown")).toEqual([])
    expect(territoryIndicators(config, null)).toEqual([])
    expect(territoryIndicators({}, "andes")).toEqual([])
  })

  it("filters a territory's indicators by dimension", () => {
    expect(dimensionIndicators(config, "soil", "andes").map((indicator) => indicator.key)).toEqual(["a", "c"])
    expect(dimensionIndicators(config, "soil", null)).toEqual([])
  })

  it("lists only the dimensions the territory has indicators for", () => {
    expect(visibleDimensions(config, "andes").map((dimension) => dimension.key)).toEqual(["soil", "water"])
    expect(visibleDimensions(config, null)).toEqual([])
  })
})
