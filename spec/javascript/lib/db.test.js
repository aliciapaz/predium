import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  db, saveForm, getForm, listForms, saveResponse, getResponses, pruneDisallowedResponses,
  enqueue, dequeue, markAttempt, queueEntries, pendingCount, applyServerForm, markSynced, deleteLocalForm
} from "lib/db"
import { clearDb } from "../support/db"
import { recordEvents, removeListeners } from "../support/events"

beforeEach(() => clearDb(db))
afterEach(() => removeListeners())

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

describe("saveForm", () => {
  it("keeps the stored sync metadata when the caller holds an older in-memory copy", async () => {
    await db.forms.put({
      client_id: "form-1",
      base_updated_at: "2026-02-01T00:00:00.000Z",
      synchronized_at: "2026-02-01T00:00:01.000Z"
    })

    await saveForm({
      client_id: "form-1",
      name: "Edited",
      base_updated_at: "2026-01-01T00:00:00.000Z",
      synchronized_at: null
    })

    const stored = await getForm("form-1")
    expect(stored.name).toBe("Edited")
    expect(stored.base_updated_at).toBe("2026-02-01T00:00:00.000Z")
    expect(stored.synchronized_at).toBe("2026-02-01T00:00:01.000Z")
  })

  it("keeps the caller's sync metadata when it is newer than the stored copy", async () => {
    await db.forms.put({ client_id: "form-1", base_updated_at: "2026-01-01T00:00:00.000Z" })

    await saveForm({ client_id: "form-1", base_updated_at: "2026-02-01T00:00:00.000Z" })

    expect((await getForm("form-1")).base_updated_at).toBe("2026-02-01T00:00:00.000Z")
  })

  it("marks the form dirty and stamps updated_at", async () => {
    await saveForm({ client_id: "form-1", updated_at: "2020-01-01T00:00:00.000Z" })

    const stored = await getForm("form-1")
    expect(stored.dirty).toBe(1)
    expect(stored.updated_at > "2020-01-01T00:00:00.000Z").toBe(true)
  })
})

describe("listForms", () => {
  it("lists the most recently updated forms first and forms without updated_at last", async () => {
    await db.forms.bulkPut([
      { client_id: "old", updated_at: "2026-01-01T00:00:00.000Z" },
      { client_id: "none" },
      { client_id: "new", updated_at: "2026-03-01T00:00:00.000Z" }
    ])

    expect((await listForms()).map((form) => form.client_id)).toEqual(["new", "old", "none"])
  })
})

describe("saveResponse", () => {
  it("stores the value as a number keyed by indicator and marks the form dirty", async () => {
    await db.forms.put({ client_id: "form-1", dirty: 0 })

    await saveResponse("form-1", "soil_cover", "3")

    expect(await getResponses("form-1")).toEqual({ soil_cover: 3 })
    expect((await getForm("form-1")).dirty).toBe(1)
  })
})

describe("pruneDisallowedResponses", () => {
  it("removes only responses outside the allowed set", async () => {
    await db.forms.put({ client_id: "form-1", dirty: 0 })
    await saveResponse("form-1", "core", 5)
    await saveResponse("form-1", "ext_kept", 4, true)
    await saveResponse("form-1", "ext_stale", 2, true)
    await saveResponse("form-2", "ext_stale", 2, true)
    await db.forms.update("form-1", { dirty: 0 })

    expect(await pruneDisallowedResponses("form-1", ["core", "ext_kept"])).toBe(1)

    expect(await getResponses("form-1")).toEqual({ core: 5, ext_kept: 4 })
    expect(await getResponses("form-2")).toEqual({ ext_stale: 2 })
    expect((await getForm("form-1")).dirty).toBe(1)
  })
})

describe("sync queue", () => {
  it("collapses repeated edits of one form into a single entry", async () => {
    await enqueue("form-1")
    await enqueue("form-1")
    await enqueue("form-2")

    const entries = await queueEntries()
    expect(entries.map((entry) => entry.form_client_id).sort()).toEqual(["form-1", "form-2"])
    expect(entries[0]).toMatchObject({ operation: "upsert", attempts: 0, last_error: null })
  })

  it("dispatches predium:queue-changed on enqueue and dequeue", async () => {
    const events = recordEvents("predium:queue-changed")

    await enqueue("form-1")
    const [entry] = await queueEntries()
    await dequeue(entry.id)

    expect(events).toHaveLength(2)
    expect(await pendingCount()).toBe(0)
  })

  it("counts attempts and records the last error", async () => {
    await enqueue("form-1")
    const [entry] = await queueEntries()

    await markAttempt(entry.id, "HTTP 500")
    await markAttempt(entry.id, "HTTP 503")

    expect(await db.sync_queue.get(entry.id)).toMatchObject({ attempts: 2, last_error: "HTTP 503" })
  })

  it("ignores attempts on an entry that is already gone", async () => {
    await expect(markAttempt(999, "HTTP 500")).resolves.toBeUndefined()
  })
})

describe("applyServerForm", () => {
  it("replaces the local form and responses with the server copy and clears dirty", async () => {
    await db.forms.put({ client_id: "form-1", name: "Local", dirty: 1, base_updated_at: "2026-01-01T00:00:00.000Z" })
    await saveResponse("form-1", "local_only", 1)
    await saveResponse("form-1", "shared", 1)

    await applyServerForm(serverForm({
      responses: [
        { indicator_key: "shared", value: 4, is_extension: false },
        { indicator_key: "ext", value: 2, is_extension: true }
      ]
    }))

    const stored = await getForm("form-1")
    expect(stored).toMatchObject({
      name: "Server name",
      dirty: 0,
      base_updated_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      synchronized_at: "2026-03-01T00:00:01.000Z",
      system_types: []
    })
    expect(await getResponses("form-1")).toEqual({ shared: 4, ext: 2 })
  })
})

describe("markSynced", () => {
  it("records the server base without touching local values or dirty", async () => {
    await db.forms.put({ client_id: "form-1", name: "Local edit", dirty: 1 })

    await markSynced("form-1", serverForm())

    expect(await getForm("form-1")).toMatchObject({
      name: "Local edit",
      dirty: 1,
      base_updated_at: "2026-03-01T00:00:00.000Z",
      synchronized_at: "2026-03-01T00:00:01.000Z"
    })
  })
})

describe("deleteLocalForm", () => {
  it("removes the form, its responses and its queue entry, leaving other forms alone", async () => {
    await db.forms.bulkPut([{ client_id: "form-1" }, { client_id: "form-2" }])
    await saveResponse("form-1", "a", 1)
    await saveResponse("form-2", "a", 2)
    await enqueue("form-1")
    await enqueue("form-2")
    const events = recordEvents("predium:queue-changed")

    await deleteLocalForm("form-1")

    expect(await getForm("form-1")).toBeUndefined()
    expect(await getResponses("form-1")).toEqual({})
    expect((await queueEntries()).map((entry) => entry.form_client_id)).toEqual(["form-2"])
    expect(await getForm("form-2")).toBeDefined()
    expect(events).toHaveLength(1)
  })
})
