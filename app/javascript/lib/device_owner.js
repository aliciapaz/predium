import { db, queueChanged, snapshotForm } from "lib/db"

// Local forms carry no owner, so the device records whose session filled the
// live stores. Unsynced work is never deleted: when that session ends, or
// another user signs in, it moves to held_work and comes back only when its
// owner signs in again. Work stored before owners were recorded has no known
// owner and goes to whoever signs in next.
const UNKNOWN_OWNER = "unknown"

export function currentUserId() {
  return document.querySelector('meta[name="predium-user"]')?.content || null
}

export async function claimDevice() {
  const userId = currentUserId()
  if (!userId) return

  const changed = await inTransaction(async () => {
    const owner = await recordedOwner()
    if (owner === userId) return false
    if (owner) await setAsideLiveWork(owner)
    await restoreHeldWork(userId)
    await restoreHeldWork(UNKNOWN_OWNER)
    await db.device_meta.put({ key: "owner", value: userId })
    return true
  })
  if (changed) queueChanged()
}

export const OWNER_CHANGED = "owner-changed"

// Another tab still showing a different user can claim the device between
// this tab's claim and its push, so the owner is checked in the same read
// as the form that is about to be sent.
export async function snapshotOwnedForm(clientId) {
  return db.transaction("r", [db.forms, db.form_responses, db.device_meta], async () => {
    if ((await recordedOwner()) !== currentUserId()) return OWNER_CHANGED
    return snapshotForm(clientId)
  })
}

export async function releaseDevice() {
  await inTransaction(async () => {
    await setAsideLiveWork((await recordedOwner()) || UNKNOWN_OWNER)
    await db.device_meta.delete("owner")
  })
  queueChanged()
}

function inTransaction(work) {
  return db.transaction("rw", [db.forms, db.form_responses, db.sync_queue, db.held_work, db.device_meta], work)
}

async function recordedOwner() {
  return (await db.device_meta.get("owner"))?.value || null
}

async function setAsideLiveWork(owner) {
  const queue = await db.sync_queue.toArray()
  const forms = await db.forms.toArray()
  const unsynced = new Set([
    ...queue.map((entry) => entry.form_client_id),
    ...forms.filter((form) => form.dirty).map((form) => form.client_id)
  ])

  if (unsynced.size > 0) {
    const held = (await db.held_work.get(owner)) || { owner_id: owner, forms: [], responses: [], queue: [] }
    held.forms.push(...forms.filter((form) => unsynced.has(form.client_id)))
    held.responses.push(...await db.form_responses.where("form_client_id").anyOf([...unsynced]).toArray())
    held.queue.push(...queue.map(({ id: _id, ...entry }) => entry))
    await db.held_work.put(held)
  }

  await db.forms.clear()
  await db.form_responses.clear()
  await db.sync_queue.clear()
}

async function restoreHeldWork(owner) {
  const held = await db.held_work.get(owner)
  if (!held) return

  await db.forms.bulkPut(held.forms)
  await db.form_responses.bulkPut(held.responses)
  const queued = new Set((await db.sync_queue.toArray()).map((entry) => entry.form_client_id))
  for (const entry of held.queue) {
    if (queued.has(entry.form_client_id)) continue
    queued.add(entry.form_client_id)
    await db.sync_queue.add(entry)
  }
  await db.held_work.delete(owner)
}
