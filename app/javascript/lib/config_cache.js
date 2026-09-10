import { getConfig, putConfig, putLocale } from "lib/db"

// Keeps the questionnaire config and both locales' translations cached in
// IndexedDB, invalidated by the server-computed content fingerprint (KTD-8).
export async function cachedConfig() {
  const cached = await getConfig()
  if (cached) return cached
  return refresh()
}

export async function refresh() {
  if (!navigator.onLine) return getConfig()

  try {
    const response = await fetch("/api/questionnaire", { headers: { Accept: "application/json" } })
    if (!response.ok) return getConfig()

    const fresh = await response.json()
    const cached = await getConfig()
    if (!cached || cached.fingerprint !== fresh.fingerprint) {
      await putConfig(fresh)
      await refreshTranslations(fresh.fingerprint)
    }
    return getConfig()
  } catch {
    return getConfig()
  }
}

async function refreshTranslations(fingerprint) {
  for (const locale of ["en", "es"]) {
    try {
      const response = await fetch(`/translations/${locale}`)
      if (response.ok) await putLocale(locale, await response.json(), fingerprint)
    } catch {
      // offline mid-refresh: keep whatever translation cache we already have
    }
  }
}

export function coreIndicators(config) {
  return config.indicators || []
}

export function dimensionIndicators(config, dimensionKey) {
  return coreIndicators(config).filter((indicator) => indicator.dimension === dimensionKey)
}

export function extensionIndicators(config, territoryKey) {
  if (!territoryKey || !config.extensions || !config.extensions[territoryKey]) return []
  return config.extensions[territoryKey].indicators || []
}
