import { refresh as refreshConfig } from "lib/config_cache"
import { claimDevice, releaseDevice } from "lib/device_owner"
import { requestPersistentStorage } from "lib/persistence"
import { seedFromServer, syncNow } from "lib/sync"

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

// The editor and results shells must be in the HTTP cache before going
// offline; warming them here makes any form's pages available, not just the
// ones the user happened to visit.
function warmShells() {
  if (!signedIn()) return
  fetch("/forms/new").catch(() => {})
  fetch("/forms/shell").catch(() => {})
}

document.addEventListener("turbo:load", () => reconcileSession())

window.addEventListener("load", async () => {
  await registerServiceWorker().catch(() => {})
  await reconcileSession()
  if (!signedIn()) return
  warmShells()
  if (navigator.onLine) {
    await refreshConfig()
    await seedFromServer()
    await syncNow()
  }
})
