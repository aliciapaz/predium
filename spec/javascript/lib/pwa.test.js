import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue, getForm, getResponses, queueEntries, saveForm, saveResponse } from "lib/db"
import { resumeAfterLogin, syncNow } from "lib/sync"
import "lib/pwa"
import { clearDb } from "../support/db"
import { resetHead, signInAs } from "../support/dom"
import { jsonResponse, stubFetch } from "../support/fetch"

beforeEach(async () => {
  await clearDb(db)
  resumeAfterLogin()
  resetHead()
})

afterEach(() => resetHead())

async function visit(event = "turbo:load") {
  const target = event === "load" ? window : document
  target.dispatchEvent(new Event(event))
  await new Promise((resolve) => setTimeout(resolve, 20))
}

async function signedOutPage(event = "load") {
  resetHead()
  await visit(event)
}

async function fillOffline(clientId) {
  await saveForm({ client_id: clientId, name: `Farm ${clientId}`, state: "draft" })
  await saveResponse(clientId, "diversity", 4)
  await enqueue(clientId)
}

async function syncedForm(clientId) {
  await db.forms.put({ client_id: clientId, name: "Synced", state: "completed", dirty: 0 })
}

describe("signed-out page load", () => {
  // Devise signs in through Turbo, so the page that purged keeps its db
  // instance into the signed-in session.
  it("clears offline forms and leaves the database usable", async () => {
    await saveForm({ client_id: "previous-user-form", state: "draft" })

    await signedOutPage()

    expect(await getForm("previous-user-form")).toBeUndefined()
    await saveForm({ client_id: "next-user-form", state: "draft" })
    expect(await getForm("next-user-form")).toMatchObject({ client_id: "next-user-form" })
  })

  it("keeps unsynced answers for their owner and gives them back on sign-in", async () => {
    signInAs("1")
    await visit()
    await fillOffline("offline-form")
    await syncedForm("synced-form")

    await signedOutPage()
    expect(await getForm("offline-form")).toBeUndefined()
    expect(await queueEntries()).toEqual([])

    signInAs("1")
    await visit()

    expect(await getForm("offline-form")).toMatchObject({ name: "Farm offline-form", dirty: 1 })
    expect(await getResponses("offline-form")).toEqual({ diversity: 4 })
    expect((await queueEntries()).map((entry) => entry.form_client_id)).toEqual(["offline-form"])
    expect(await getForm("synced-form")).toBeUndefined()
  })

  it("also clears the session left behind by a Turbo sign-out", async () => {
    signInAs("1")
    await visit()
    await fillOffline("offline-form")

    await signedOutPage("turbo:load")
    expect(await getForm("offline-form")).toBeUndefined()

    signInAs("1")
    await visit()
    expect(await getResponses("offline-form")).toEqual({ diversity: 4 })
  })

  it("keeps work from before owners were recorded and hands it to the next sign-in", async () => {
    await fillOffline("legacy-form")

    await signedOutPage()
    signInAs("1")
    await visit()

    expect((await queueEntries()).map((entry) => entry.form_client_id)).toEqual(["legacy-form"])
  })
})

describe("another user on the same device", () => {
  it("never sees or syncs the previous user's unsynced work, which waits for its owner", async () => {
    signInAs("1")
    await visit()
    await fillOffline("agent-one-form")
    await signedOutPage()

    signInAs("2")
    await visit()
    expect(await getForm("agent-one-form")).toBeUndefined()
    expect(await queueEntries()).toEqual([])

    await signedOutPage()
    signInAs("1")
    await visit()
    expect(await getResponses("agent-one-form")).toEqual({ diversity: 4 })
  })

  it("does not push the previous user's queue when the session changes without a signed-out page", async () => {
    signInAs("1")
    await visit()
    await fillOffline("agent-one-form")
    const fetch = stubFetch(async () => jsonResponse({ form: {} }))

    signInAs("2")
    await syncNow()

    expect(fetch).not.toHaveBeenCalled()
    expect(await getForm("agent-one-form")).toBeUndefined()

    signInAs("1")
    await visit()
    expect(await getResponses("agent-one-form")).toEqual({ diversity: 4 })
  })
})

describe("persistent storage", () => {
  function stubStorage(persisted = false) {
    const storage = { persisted: vi.fn(async () => persisted), persist: vi.fn(async () => true) }
    Object.defineProperty(navigator, "storage", { value: storage, configurable: true })
    return storage
  }

  afterEach(() => { delete navigator.storage })

  it("asks the browser to keep offline data once a user is signed in", async () => {
    const storage = stubStorage()
    signInAs("1")

    await visit()

    expect(storage.persist).toHaveBeenCalled()
  })

  it("asks again on the first save made offline", async () => {
    const storage = stubStorage()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    await enqueue("offline-form")

    expect(storage.persist).toHaveBeenCalled()
  })

  it("does not ask again once storage is persistent", async () => {
    const storage = stubStorage(true)
    signInAs("1")

    await visit()

    expect(storage.persist).not.toHaveBeenCalled()
  })
})
