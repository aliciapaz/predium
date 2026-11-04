import { afterEach, describe, expect, it, vi } from "vitest"
import { getForm, saveForm } from "lib/db"
import "lib/pwa"
import { resetHead, signIn } from "../support/dom"
import { jsonResponse, stubFetch } from "../support/fetch"

afterEach(() => {
  resetHead()
  delete navigator.serviceWorker
})

describe("signed-out page load", () => {
  // Devise signs in through Turbo, so the page that purged keeps its db
  // instance into the signed-in session.
  it("purges offline forms and leaves the database usable", async () => {
    await saveForm({ client_id: "previous-user-form", state: "draft" })

    window.dispatchEvent(new Event("load"))

    await vi.waitFor(async () => expect(await getForm("previous-user-form")).toBeUndefined())
    await saveForm({ client_id: "next-user-form", state: "draft" })
    expect(await getForm("next-user-form")).toMatchObject({ client_id: "next-user-form" })
  })
})

describe("Turbo sign-in", () => {
  function renderAssets() {
    document.head.insertAdjacentHTML("beforeend", `
      <link rel="stylesheet" href="/assets/tailwind-abc.css">
      <link rel="modulepreload" href="/assets/application-abc.js">
      <script type="importmap">{"imports": {"application": "/assets/application-abc.js", "lib/db": "/assets/lib/db-abc.js"}}</script>
    `)
  }

  function stubServiceWorker() {
    const postMessage = vi.fn()
    navigator.serviceWorker = { ready: Promise.resolve({ active: { postMessage } }) }
    return postMessage
  }

  function questionnaireFetches(fetch) {
    return fetch.mock.calls.filter(([url]) => url === "/api/questionnaire?schema=2").length
  }

  // The module-level once-per-sign-in latch carries across tests, so the whole
  // session lifecycle lives in one case.
  it("hands the service worker the app shell and seeds once per sign-in", async () => {
    const fetch = stubFetch(async () => jsonResponse({ forms: [] }))
    const postMessage = stubServiceWorker()
    renderAssets()
    signIn()

    document.dispatchEvent(new Event("turbo:load"))
    window.dispatchEvent(new Event("load"))

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({
      type: "predium:precache",
      assets: [
        "http://localhost:3000/assets/tailwind-abc.css",
        "http://localhost:3000/assets/application-abc.js",
        "http://localhost:3000/assets/lib/db-abc.js"
      ]
    }))
    await vi.waitFor(() => expect(questionnaireFetches(fetch)).toBe(1))
    expect(postMessage).toHaveBeenCalledTimes(1)

    resetHead()
    document.dispatchEvent(new Event("turbo:load"))
    renderAssets()
    signIn()
    document.dispatchEvent(new Event("turbo:load"))

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(questionnaireFetches(fetch)).toBe(2))
  })
})
