// Hand-rolled service worker (KTD-1, amended ADR-3). Strategies:
//   - HTML documents: network-first, cache fallback, shell fallback for
//     form URLs so offline-created forms have a page to boot from
//   - Propshaft assets (digested, immutable): cache-first
//   - /api/questionnaire and /translations/:locale: stale-while-revalidate
//   - other GET /api/ requests: network-first with cache fallback
//   - images: cache-first
// Bump VERSION to invalidate all caches on the next activate.
const VERSION = "v1"
const SHELL_CACHE = `predium-shell-${VERSION}`
const DATA_CACHE = `predium-data-${VERSION}`

const EDITOR_SHELL = "/forms/new"
const RESULTS_SHELL = "/forms/shell"

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Background Sync (progressive enhancement, KTD-6): the page owns the queue,
// so just wake every open client instead of syncing from the worker.
self.addEventListener("sync", (event) => {
  if (event.tag === "predium-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => client.postMessage("predium:sync"))
      })
    )
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/users")) return
  if (url.pathname === "/service-worker") return

  if (isDocument(request)) {
    event.respondWith(documentStrategy(request, url))
  } else if (url.pathname === "/api/questionnaire" || url.pathname.startsWith("/translations/") || url.pathname === "/manifest") {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE))
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA_CACHE))
  } else if (url.pathname.startsWith("/assets/") || request.destination === "image") {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})

function isDocument(request) {
  return request.mode === "navigate" ||
    request.destination === "document" ||
    (request.headers.get("Accept") || "").includes("text/html")
}

async function documentStrategy(request, url) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put(stripParams(url), response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(stripParams(url))
    if (cached) return cached
    return shellFallback(url)
  }
}

async function shellFallback(url) {
  if (/^\/forms\/[^/]+\/edit$/.test(url.pathname) || url.pathname === "/forms/new") {
    const shell = await caches.match(EDITOR_SHELL)
    if (shell) return shell
  }
  if (/^\/forms\/[^/]+$/.test(url.pathname)) {
    const shell = await caches.match(RESULTS_SHELL)
    if (shell) return shell
  }
  const root = await caches.match("/")
  if (root) return root
  return Response.error()
}

function stripParams(url) {
  return url.origin + url.pathname
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || refresh
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}
