import { getLocale, putLocale } from "lib/db"

let translations = null

export function locale() {
  return document.documentElement.lang || "en"
}

// Loads the flat translation map for the active locale: IndexedDB first so it
// works offline, network as fallback for a first-ever visit. When the page
// names a newer translations version, an online load replaces the cached copy
// first, so strings added since the last visit never render as raw keys.
export async function load() {
  const active = locale()
  const version = document.querySelector('meta[name="predium-translations"]')?.content || null
  const cached = await getLocale(active)

  if (cached && (!version || cached.fingerprint === version || !navigator.onLine)) {
    translations = cached.translations
    return translations
  }

  // navigator.onLine is true on a network with no internet, so any failure
  // keeps the cached copy rather than leaving the page without strings.
  try {
    const response = await fetch(version ? `/translations/${active}?v=${encodeURIComponent(version)}` : `/translations/${active}`)
    if (!response.ok) throw new Error(`translations fetch failed: ${response.status}`)
    translations = await response.json()
    await putLocale(active, translations, response.headers?.get("X-Translations-Version") || version)
  } catch (error) {
    if (!cached) throw error
    translations = cached.translations
  }
  return translations
}

export function t(key, interpolations = {}) {
  let value = (translations && translations[key]) || key
  Object.entries(interpolations).forEach(([name, replacement]) => {
    value = value.replaceAll(`%{${name}}`, replacement)
  })
  return value
}

// Whether a translation actually exists for a key. t() returns the key itself
// when missing, so callers cannot use it to detect absence (KTD-7).
export function has(key) {
  return Boolean(translations && Object.prototype.hasOwnProperty.call(translations, key))
}
