import Dexie from "dexie"
import { db, saveForm, saveResponse, getForm, getResponses, enqueue, queueEntries, pruneDisallowedResponses, deleteLocalForm } from "lib/db"
import { syncNow } from "/app/javascript/lib/sync.js"

const results = []
const clientId = "sync-regression"
const originalFetch = window.fetch
const originalDate = window.Date

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function reset() {
  await db.delete()
  await db.open()
  await saveForm({ client_id: clientId, name: "Test farm", state: "draft" })
  await saveResponse(clientId, "first", 3)
  await enqueue(clientId)
}

function respondToPush(beforeResponse = async () => {}) {
  const payloads = []
  window.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body)
    payloads.push(payload)
    await beforeResponse()
    return { ok: true, json: async () => ({ form: {
      ...payload.form, client_id: clientId, state: "draft",
      updated_at: "2026-10-17T12:00:01.000Z", synchronized_at: "2026-10-17T12:00:01.000Z",
      responses: Object.entries(payload.responses).map(([indicator_key, value]) => ({ indicator_key, value }))
    } }) }
  }
  return payloads
}

async function test(name, run) {
  try {
    await reset()
    await run()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`)
  } finally {
    window.fetch = originalFetch
    window.Date = originalDate
  }
}

await test("answer and dirty marker roll back together", async () => {
  const update = db.forms.update
  db.forms.update = async () => { throw new Error("Injected marker failure") }
  try {
    await saveResponse(clientId, "second", 7).catch(() => {})
  } finally {
    db.forms.update = update
  }
  assert((await getResponses(clientId)).second === undefined, "Answer committed without its dirty marker")
})

await test("same-millisecond edits survive a push and reach the next payload", async () => {
  const timestamp = (await getForm(clientId)).updated_at
  window.Date = class extends originalDate {
    constructor(...args) { super(...(args.length ? args : [timestamp])) }
  }
  const payloads = respondToPush(async () => {
    await saveResponse(clientId, "second", 7)
    await enqueue(clientId)
  })
  await syncNow()
  assert((await getResponses(clientId)).second === 7, "In-flight score was replaced by the server snapshot")
  assert((await getForm(clientId)).dirty === 1, "In-flight edit was marked clean")
  assert((await queueEntries()).length === 1, "In-flight edit was dequeued")
  assert((await getForm(clientId)).base_updated_at === "2026-10-17T12:00:01.000Z", "Server base was not advanced")
  const nextPayloads = respondToPush()
  await syncNow()
  assert(nextPayloads[0].responses.second === 7, "Next push omitted the new score")
  assert(payloads[0].responses.second === undefined, "Test did not edit during the first push")
  assert((await queueEntries()).length === 0, "Successful unchanged push stayed queued")
})

await test("an edit after the acknowledgement read survives replacement and dequeue", async () => {
  const get = db.forms.get
  let armed = false
  let edit
  respondToPush(async () => { armed = true })
  db.forms.get = function (...args) {
    return get.apply(this, args).then((form) => {
      if (armed) {
        armed = false
        edit = Dexie.ignoreTransaction(async () => {
          await saveResponse(clientId, "late", 10)
          await enqueue(clientId)
        })
        if (!Dexie.currentTransaction) return edit.then(() => form)
      }
      return form
    })
  }
  try {
    await syncNow()
    await edit
  } finally {
    db.forms.get = get
  }
  assert((await getResponses(clientId)).late === 10, "Late score was overwritten after the edit check")
  assert((await getForm(clientId)).dirty === 1, "Late score was marked clean")
  assert((await queueEntries()).length === 1, "Late score lost its queue entry")
})

await test("six rapidly scored answers all reach the next push", async () => {
  respondToPush(async () => {
    await Promise.all(["second", "third", "fourth", "fifth", "sixth"].map(async (key) => {
      await saveResponse(clientId, key, 10)
      await enqueue(clientId)
    }))
  })
  await syncNow()
  assert(Object.keys(await getResponses(clientId)).length === 6, "Rapid scoring lost answers locally")
  const payloads = respondToPush()
  await syncNow()
  assert(Object.keys(payloads[0].responses).length === 6, "Follow-up push lost answers")
  assert((await queueEntries()).length === 0, "Rapid scoring did not drain")
})

await test("stale farm records and extension pruning preserve edits during a push", async () => {
  const staleForm = await getForm(clientId)
  await saveResponse(clientId, "extension", 10, true)
  const before = await getForm(clientId)
  window.Date = class extends originalDate {
    constructor(...args) { super(...(args.length ? args : [before.updated_at])) }
  }
  respondToPush(async () => {
    await saveForm({ ...staleForm, name: "New name" })
    await pruneDisallowedResponses(clientId, [])
  })
  await syncNow()
  const current = await getForm(clientId)
  assert(current.name === "New name", "Stale farm save reset the edit counter")
  assert((await getResponses(clientId)).extension === undefined, "Server restored a pruned extension")
  const payloads = respondToPush()
  await syncNow()
  assert(payloads[0].form.name === "New name", "Farm edit was not pushed")
  assert(payloads[0].responses.extension === undefined, "Pruned extension was pushed")
})

await test("concurrent enqueues retain one entry per form", async () => {
  await db.sync_queue.clear()
  await Promise.all(Array.from({ length: 6 }, () => enqueue(clientId)))
  assert((await queueEntries()).length === 1, "Concurrent edits created duplicate queue entries")
})

await test("existing forms without a revision still acknowledge an unchanged push", async () => {
  const form = await getForm(clientId)
  delete form.local_generation
  await db.forms.put(form)
  respondToPush()
  await syncNow()
  assert((await getForm(clientId)).dirty === 0, "Legacy form was not marked clean")
  assert((await queueEntries()).length === 0, "Legacy form stayed queued")
})

await test("acknowledgement does not restore a form deleted during the push", async () => {
  respondToPush(async () => { await deleteLocalForm(clientId) })
  await syncNow()
  assert((await getForm(clientId)) === undefined, "Acknowledgement restored the deleted form")
  assert(Object.keys(await getResponses(clientId)).length === 0, "Acknowledgement restored deleted answers")
  assert((await queueEntries()).length === 0, "Deleted form stayed queued")
})

await test("edits from an older tab survive a push", async () => {
  respondToPush(async () => {
    await db.form_responses.put({ form_client_id: clientId, indicator_key: "legacy", value: 8 })
    const form = await getForm(clientId)
    await db.forms.update(clientId, { updated_at: new originalDate(new originalDate(form.updated_at).getTime() + 1).toISOString(), dirty: 1 })
    await enqueue(clientId)
  })
  await syncNow()
  assert((await getResponses(clientId)).legacy === 8, "Older tab's edit was overwritten")
  const payloads = respondToPush()
  await syncNow()
  assert(payloads[0].responses.legacy === 8, "Older tab's edit never reached the server")
})

await test("keeping local changes pushes farm edits made during the conflict", async () => {
  let calls = 0
  let forced
  window.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body)
    if (++calls === 1) return { ok: false, status: 409, json: async () => ({ conflict: {
      reason: "stale", form: { client_id: clientId, updated_at: "2026-10-17T12:00:02.000Z" }
    } }) }
    forced = payload
    return { ok: true, json: async () => ({ form: {
      ...payload.form, client_id: clientId, updated_at: "2026-10-17T12:00:03.000Z",
      responses: Object.entries(payload.responses).map(([indicator_key, value]) => ({ indicator_key, value }))
    } }) }
  }
  const choose = (event) => {
    event.detail.handled = true
    saveForm({ client_id: clientId, name: "Edited during conflict", state: "draft" }).then(() => event.detail.resolve("keep"))
  }
  document.addEventListener("predium:conflict", choose)
  try {
    await syncNow()
  } finally {
    document.removeEventListener("predium:conflict", choose)
  }
  assert(forced?.force === true, "Keep did not force a new push")
  assert(forced.form.name === "Edited during conflict", "Keep restored the stale farm snapshot")
  assert(forced.base_updated_at === "2026-10-17T12:00:02.000Z", "Keep did not advance the server base")
})

await db.delete()
document.querySelector("#results").textContent = results.join("\n")
document.body.dataset.complete = "true"
document.body.dataset.failed = String(results.filter((result) => result.startsWith("FAIL")).length)
