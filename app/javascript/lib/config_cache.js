import { getConfig, putConfig, putLocale, pruneUnknownResponses } from "lib/db"

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
      // Prune BEFORE persisting the new fingerprint: if this run is interrupted,
      // the old fingerprint remains so the heal retries on the next load instead
      // of being masked by a fingerprint match. A config change can remove keys
      // (this refactor's placeholders); dropping local responses no config knows
      // about stops old drafts 422-looping. Pruning is idempotent on rerun.
      await pruneUnknownResponses(allKnownKeys(fresh))
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

export function principles(config) {
  return config.principles || []
}

// Every indicator key any territory can hold: principles plus all extensions.
function allKnownKeys(config) {
  const keys = principles(config).map((p) => p.key)
  Object.values(config.extensions || {}).forEach((ext) => {
    ;(ext.indicators || []).forEach((indicator) => keys.push(indicator.key))
  })
  return keys
}

// Resolved indicator chain for a form's territory (already flattened server-side).
export function territoryIndicators(config, territoryKey) {
  if (!territoryKey || !config.extensions || !config.extensions[territoryKey]) return []
  return config.extensions[territoryKey].indicators || []
}

export function dimensionIndicators(config, dimensionKey, territoryKey) {
  return territoryIndicators(config, territoryKey).filter((indicator) => indicator.dimension === dimensionKey)
}

// Dimensions that have at least one indicator for this territory (others hidden).
export function visibleDimensions(config, territoryKey) {
  const withIndicators = new Set(territoryIndicators(config, territoryKey).map((i) => i.dimension))
  return (config.dimensions || []).filter((dimension) => withIndicators.has(dimension.key))
}
