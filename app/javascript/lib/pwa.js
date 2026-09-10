import { db } from "lib/db"
import { refresh as refreshConfig } from "lib/config_cache"
import { seedFromServer, syncNow } from "lib/sync"

function signedIn() {
  return Boolean(document.querySelector('meta[name="predium-signed-in"]'))
}

// On a shared browser the offline stores outlive the session, so a signed-out
// page must wipe the previous user's forms and cached authenticated responses
// before anyone else signs in.
async function purgeOfflineData() {
  try { await db.delete() } catch { /* nothing cached yet */ }
  if (!("caches" in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch { /* Cache API unavailable */ }
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

window.addEventListener("load", async () => {
  await registerServiceWorker().catch(() => {})
  if (!signedIn()) {
    await purgeOfflineData()
    return
  }
  warmShells()
  if (navigator.onLine) {
    await refreshConfig()
    await seedFromServer()
    await syncNow()
  }
})
