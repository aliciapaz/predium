import { vi } from "vitest"

export function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

export function stubFetch(implementation = async () => jsonResponse({})) {
  const fetch = vi.fn(implementation)
  vi.stubGlobal("fetch", fetch)
  return fetch
}
