import { refresh as refreshConfig } from "lib/config_cache"
import { claimDevice, releaseDevice } from "lib/device_owner"
import { requestPersistentStorage } from "lib/persistence"
import { resumeAfterLogin, seedFromServer, syncNow } from "lib/sync"

function signedIn() {
  return Boolean(document.querySelector('meta[name="predium-signed-in"]'))
}

// On a shared browser the offline stores outlive the session, so a signed-out
// page must hide the previous user's forms and cached authenticated responses
// before anyone else signs in. Unsynced work is set aside, not deleted.
async function endSession() {
  try { await releaseDevice() } catch { /* IndexedDB unavailable */ }
  if (!("caches" in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch { /* Cache API unavailable */ }
}

// Devise signs in and out through Turbo, which fires turbo:load but not load.
async function reconcileSession() {
  if (!signedIn()) return endSession()
  try { await claimDevice() } catch { /* IndexedDB unavailable */ }
  requestPersistentStorage()
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return

  const registration = await navigator.serviceWorker.register("/service-worker")

  // Background Sync where available (not iOS Safari); page-context sync is
  // the primary path either way (KTD-6).
  if ("sync" in registration) {
    try { await registration.sync.register("predium-sync") } catch { /* denied: fallback triggers cover it */ }
  }
}

// The worker only caches what passes through it, and neither the first page
// load (before it takes control) nor the requests after a Turbo sign-in do, so
// a fresh home-screen install would have nothing to open offline. Only the
// page knows the digested asset paths, so it hands them over.
function shellAssets() {
  const links = document.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"], link[rel="preload"][as="font"]')
  const importmap = document.querySelector('script[type="importmap"]')
  const modules = importmap ? Object.values(JSON.parse(importmap.textContent).imports) : []
  const hrefs = Array.from(links, (link) => link.href)
  return [...new Set([...hrefs, ...modules.map((path) => new URL(path, document.baseURI).href)])]
}

async function warmShells() {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage({ type: "predium:precache", assets: shellAssets() })
}

// After a deploy, `ready` still resolves to the outgoing worker, which ignores
// the precache message; repeat it for the worker that takes over.
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (signedIn()) warmShells().catch(() => {})
})

let prepared = false

// Sign-out also goes through Turbo, so the same document can host a second
// sign-in that needs its own setup.
async function prepareOffline() {
  if (prepared) return
  prepared = true
  warmShells().catch(() => {})
  if (navigator.onLine) {
    await refreshConfig()
    await seedFromServer()
    await syncNow()
  }
}

// A Turbo sign-in keeps this page's JS, including the pause from the 401
// that sent the user to sign in, and restored work has nothing else to push it.
document.addEventListener("turbo:load", async () => {
  if (!signedIn()) prepared = false
  await reconcileSession()
  if (!signedIn()) return
  resumeAfterLogin()
  await prepareOffline()
  syncNow()
})

window.addEventListener("load", async () => {
  await registerServiceWorker().catch(() => {})
  await reconcileSession()
  if (signedIn()) await prepareOffline()
})
