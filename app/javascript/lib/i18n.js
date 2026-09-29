import { getLocale, putLocale } from "lib/db"

let translations = null
let currentLocale = null

export function locale() {
  return document.documentElement.lang || "en"
}

// Loads the flat translation map for the active locale: IndexedDB first so it
// works offline, network as fallback for a first-ever visit.
export async function load() {
  const active = locale()
  if (translations && currentLocale === active) return translations

  const cached = await getLocale(active)
  if (cached) {
    translations = cached.translations
  } else {
    const response = await fetch(`/translations/${active}`)
    if (!response.ok) throw new Error(`translations fetch failed: ${response.status}`)
    translations = await response.json()
    await putLocale(active, translations, null)
  }
  currentLocale = active
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
