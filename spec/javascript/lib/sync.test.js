import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue, getForm, getResponses, queueEntries, saveForm, saveResponse } from "lib/db"
import { hydrateForm, resumeAfterLogin, seedFromServer, syncNow } from "lib/sync"
import { clearDb } from "../support/db"
import { resetHead, signIn } from "../support/dom"
import { recordEvents, listen, removeListeners } from "../support/events"
import { jsonResponse, stubFetch } from "../support/fetch"

beforeEach(async () => {
  await clearDb(db)
  localStorage.clear()
  resumeAfterLogin()
  signIn()
})

afterEach(() => {
  removeListeners()
  resetHead()
  delete window.Turbo
})

function serverForm(overrides = {}) {
  return {
    client_id: "form-1",
    name: "Server name",
    state: "draft",
    updated_at: "2026-03-01T00:00:00.000Z",
    synchronized_at: "2026-03-01T00:00:01.000Z",
    responses: [],
    ...overrides
  }
}

async function putLocalForm(overrides = {}) {
  await db.forms.put({
    client_id: "form-1",
    name: "Local name",
    dirty: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
    base_updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  })
}

async function queueLocalForm(overrides = {}) {
  await putLocalForm({ dirty: 1, ...overrides })
  await enqueue(overrides.client_id || "form-1")
}

function requestBody(fetch, call = 0) {
  return JSON.parse(fetch.mock.calls[call][1].body)
}

function resolveConflictWith(choice) {
  listen("predium:conflict", (event) => {
    event.detail.handled = true
    event.detail.resolve(choice)
  })
}

describe("seedFromServer", () => {
  it("applies clean server forms but never clobbers queued or dirty local copies", async () => {
    await queueLocalForm({ client_id: "queued", name: "Queued edit" })
    await putLocalForm({ client_id: "dirty", name: "Dirty edit", dirty: 1 })
    await putLocalForm({ client_id: "clean", name: "Stale" })
    stubFetch(async () => jsonResponse({
      forms: [
        serverForm({ client_id: "queued" }),
        serverForm({ client_id: "dirty" }),
        serverForm({ client_id: "clean" }),
        serverForm({ client_id: "fresh", responses: [{ indicator_key: "a", value: 3, is_extension: false }] })
      ]
    }))

    await seedFromServer()

    expect((await getForm("queued")).name).toBe("Queued edit")
    expect((await getForm("dirty")).name).toBe("Dirty edit")
    expect(await getForm("clean")).toMatchObject({ name: "Server name", dirty: 0 })
    expect(await getResponses("fresh")).toEqual({ a: 3 })
  })

  it("drops clean local forms the server no longer lists and keeps unsynced ones", async () => {
    await putLocalForm({ client_id: "discarded" })
    await putLocalForm({ client_id: "dirty", dirty: 1 })
    await queueLocalForm({ client_id: "queued", dirty: 0 })
    stubFetch(async () => jsonResponse({ forms: [] }))

    await seedFromServer()

    expect(await getForm("discarded")).toBeUndefined()
    expect(await getForm("dirty")).toBeDefined()
    expect(await getForm("queued")).toBeDefined()
  })

  it("leaves the local cache alone when the server responds with an error", async () => {
    await putLocalForm({ client_id: "kept" })
    stubFetch(async () => jsonResponse({}, 500))

    await seedFromServer()

    expect(await getForm("kept")).toBeDefined()
  })

  it("swallows network failures", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch") })

    await expect(seedFromServer()).resolves.toBeUndefined()
  })

  it("does nothing when signed out", async () => {
    resetHead()
    const fetch = stubFetch()

    await seedFromServer()

    expect(fetch).not.toHaveBeenCalled()
  })

  it("does nothing when offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const fetch = stubFetch()

    await seedFromServer()

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("hydrateForm", () => {
  it("pulls the single form into IndexedDB and reports success", async () => {
    const fetch = stubFetch(async () => jsonResponse({ form: serverForm() }))

    expect(await hydrateForm("form-1")).toBe(true)
    expect(fetch.mock.calls[0][0]).toBe("/api/forms/form-1")
    expect(await getForm("form-1")).toMatchObject({ name: "Server name", dirty: 0 })
  })

  it("refuses to overwrite a queued local copy", async () => {
    await queueLocalForm({ dirty: 0 })
    stubFetch(async () => jsonResponse({ form: serverForm() }))

    expect(await hydrateForm("form-1")).toBe(false)
    expect((await getForm("form-1")).name).toBe("Local name")
  })

  it("refuses to overwrite a dirty local copy", async () => {
    await putLocalForm({ dirty: 1 })
    stubFetch(async () => jsonResponse({ form: serverForm() }))

    expect(await hydrateForm("form-1")).toBe(false)
    expect((await getForm("form-1")).name).toBe("Local name")
  })

  it("reports failure on an error response, a missing form, or a network error", async () => {
    stubFetch(async () => jsonResponse({}, 404))
    expect(await hydrateForm("form-1")).toBe(false)

    stubFetch(async () => jsonResponse({ form: null }))
    expect(await hydrateForm("form-1")).toBe(false)

    stubFetch(async () => { throw new TypeError("Failed to fetch") })
    expect(await hydrateForm("form-1")).toBe(false)
  })

  it("reports failure without fetching when signed out or offline", async () => {
    const fetch = stubFetch()
    resetHead()
    expect(await hydrateForm("form-1")).toBe(false)

    signIn()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    expect(await hydrateForm("form-1")).toBe(false)

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("syncNow", () => {
  it("pushes the current local state with the sync base and CSRF token", async () => {
    await queueLocalForm({ system_types: undefined })
    await saveResponse("form-1", "soil_cover", 4)
    const fetch = stubFetch(async () => jsonResponse({ form: serverForm() }))

    await syncNow()

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe("/api/forms/form-1")
    expect(options.method).toBe("PUT")
    expect(options.headers["X-CSRF-Token"]).toBe("test-csrf-token")
    const body = requestBody(fetch)
    expect(body.form).toMatchObject({ name: "Local name", phone: null, system_types: [] })
    expect(body.responses).toEqual({ soil_cover: 4 })
    expect(body.base_updated_at).toBe("2026-01-01T00:00:00.000Z")
    expect(body.force).toBe(false)
  })

  it("applies the server copy and dequeues on success", async () => {
    await queueLocalForm()
    stubFetch(async () => jsonResponse({ form: serverForm() }))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(await getForm("form-1")).toMatchObject({ name: "Server name", dirty: 0 })
    expect(await queueEntries()).toEqual([])
    expect(statuses).toEqual([{ status: "started" }, { status: "finished", pending: 0 }])
    expect(localStorage.getItem("predium:last_sync")).not.toBeNull()
  })

  it("keeps an edit made while the push was in flight and records the new sync base", async () => {
    await queueLocalForm()
    stubFetch(async () => {
      const inMemory = await getForm("form-1")
      await saveForm({ ...inMemory, name: "Edited mid-flight" })
      return jsonResponse({ form: serverForm() })
    })

    await syncNow()

    expect(await getForm("form-1")).toMatchObject({
      name: "Edited mid-flight",
      dirty: 1,
      base_updated_at: "2026-03-01T00:00:00.000Z",
      synchronized_at: "2026-03-01T00:00:01.000Z"
    })
    expect(await queueEntries()).toHaveLength(1)
  })

  it("drops the local form when the server reports it deleted", async () => {
    await queueLocalForm()
    stubFetch(async () => jsonResponse({ deleted: true }))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(await getForm("form-1")).toBeUndefined()
    expect(await queueEntries()).toEqual([])
    expect(statuses).toContainEqual({ status: "deleted", name: "Local name" })
  })

  it("dequeues an entry whose form no longer exists locally without pushing", async () => {
    await enqueue("ghost")
    const fetch = stubFetch()

    await syncNow()

    expect(fetch).not.toHaveBeenCalled()
    expect(await queueEntries()).toEqual([])
  })

  it("takes the server copy silently when the conflicting form is completed", async () => {
    await queueLocalForm()
    stubFetch(async () => jsonResponse({
      conflict: { reason: "completed", form: serverForm({ state: "completed" }) }
    }, 409))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(await getForm("form-1")).toMatchObject({ state: "completed", dirty: 0 })
    expect(await queueEntries()).toEqual([])
    expect(statuses).toContainEqual({ status: "conflict_completed", name: "Local name" })
  })

  it("re-pushes with force on top of the server base when the user keeps the local draft", async () => {
    await queueLocalForm()
    const conflictForm = serverForm({ updated_at: "2026-04-01T00:00:00.000Z" })
    const fetch = stubFetch(async () => jsonResponse({ form: serverForm({ name: "Local name" }) }))
    fetch.mockImplementationOnce(async () => jsonResponse({ conflict: { reason: "stale", form: conflictForm } }, 409))
    resolveConflictWith("keep")

    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(2)
    const retry = requestBody(fetch, 1)
    expect(retry.force).toBe(true)
    expect(retry.base_updated_at).toBe("2026-04-01T00:00:00.000Z")
    expect(retry.form.name).toBe("Local name")
    expect(await queueEntries()).toEqual([])
  })

  it("applies the server draft and reloads the page when the user picks the server copy", async () => {
    await queueLocalForm()
    window.Turbo = { visit: vi.fn() }
    stubFetch(async () => jsonResponse({ conflict: { reason: "stale", form: serverForm() } }, 409))
    resolveConflictWith("server")
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(await getForm("form-1")).toMatchObject({ name: "Server name", dirty: 0 })
    expect(await queueEntries()).toEqual([])
    expect(statuses).toContainEqual({ status: "conflict_resolved", name: "Local name" })
    expect(window.Turbo.visit).toHaveBeenCalledWith(window.location.href, { action: "replace" })
  })

  it("leaves a draft conflict queued when no dialog handles it", async () => {
    await queueLocalForm()
    await queueLocalForm({ client_id: "form-2" })
    const fetch = stubFetch(async () => jsonResponse({ conflict: { reason: "stale", form: serverForm() } }, 409))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await getForm("form-1")).name).toBe("Local name")
    expect(await queueEntries()).toHaveLength(2)
    expect(statuses.at(-1)).toEqual({ status: "finished", pending: 2 })
  })

  it("pauses on 401 until resumeAfterLogin is called", async () => {
    await queueLocalForm()
    const fetch = stubFetch(async () => jsonResponse({}, 401))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()
    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(statuses).toContainEqual({ status: "needs_login" })
    expect(await queueEntries()).toHaveLength(1)

    resumeAfterLogin()
    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("records a 422 rejection and moves on to the next entry", async () => {
    await queueLocalForm()
    await queueLocalForm({ client_id: "form-2" })
    const fetch = stubFetch(async (url) => url.endsWith("form-1")
      ? jsonResponse({}, 422)
      : jsonResponse({ form: serverForm({ client_id: "form-2" }) }))

    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await queueEntries()).toEqual([
      expect.objectContaining({ form_client_id: "form-1", attempts: 1, last_error: "HTTP 422" })
    ])
  })

  it("reports a rejected push as status \"error\" with the HTTP status alongside", async () => {
    await queueLocalForm()
    stubFetch(async () => jsonResponse({}, 500))
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(statuses).toContainEqual({ status: "error", httpStatus: 500, name: "Local name" })
  })

  it("stops draining on any other server error", async () => {
    await queueLocalForm()
    await queueLocalForm({ client_id: "form-2" })
    const fetch = stubFetch(async () => jsonResponse({}, 500))

    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(1)
    const entries = await queueEntries()
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.form_client_id === "form-1").last_error).toBe("HTTP 500")
  })

  it("marks the attempt and reports offline on a network error", async () => {
    await queueLocalForm()
    await queueLocalForm({ client_id: "form-2" })
    const fetch = stubFetch(async () => { throw new TypeError("Failed to fetch") })
    const statuses = recordEvents("predium:sync-status")

    await syncNow()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [first] = await queueEntries()
    expect(first).toMatchObject({ attempts: 1, last_error: "TypeError: Failed to fetch" })
    expect(statuses.map((detail) => detail.status)).toEqual(["started", "offline", "finished"])
  })

  it("ignores a second call while a sync is already running", async () => {
    await queueLocalForm()
    const fetch = stubFetch(async () => jsonResponse({ form: serverForm() }))

    await Promise.all([syncNow(), syncNow()])

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("does nothing when signed out or offline", async () => {
    await queueLocalForm()
    const fetch = stubFetch()

    resetHead()
    await syncNow()
    signIn()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    await syncNow()

    expect(fetch).not.toHaveBeenCalled()
  })
})
