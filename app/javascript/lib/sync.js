import {
  getForm, listForms, snapshotForm, rebaseForm, queueEntries, dequeue, markAttempt,
  applyServerForm, acknowledgePush, deleteLocalForm, pendingCount, queueChanged
} from "lib/db"

// Page-context sync per KTD-6: Background Sync is progressive enhancement
// (registered in lib/pwa.js); the primary triggers are the online event, app
// load, visibility change, and the Sync Now button.
let syncing = false
let paused = false

const FARM_FIELDS = [
  "name", "national_id", "date_of_birth", "phone", "gender", "work_force",
  "land_area", "latitude", "longitude", "country", "region", "locality",
  "observations", "territory_key", "system_types"
]

function signedIn() {
  return Boolean(document.querySelector('meta[name="predium-signed-in"]'))
}

export function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content
}

function notify(status, detail = {}) {
  document.dispatchEvent(new CustomEvent("predium:sync-status", { detail: { status, ...detail } }))
}

export async function seedFromServer() {
  if (!signedIn() || !navigator.onLine) return

  try {
    const response = await fetch("/api/forms", { headers: { Accept: "application/json" } })
    if (!response.ok) return
    const payload = await response.json()
    const pending = new Set((await queueEntries()).map((entry) => entry.form_client_id))
    for (const serverForm of payload.forms) {
      if (pending.has(serverForm.client_id)) continue
      // A dirty form with no queue entry means a save crashed between writing
      // the value and enqueuing it; keep the local edit rather than clobber it.
      const local = await getForm(serverForm.client_id)
      if (local && local.dirty) continue
      await applyServerForm(serverForm)
    }
    // The index returns this user's complete kept set, so a clean local form
    // missing from it was discarded elsewhere: drop it unless it holds
    // unsynced work.
    const serverIds = new Set(payload.forms.map((serverForm) => serverForm.client_id))
    for (const local of await listForms()) {
      if (serverIds.has(local.client_id) || pending.has(local.client_id) || local.dirty) continue
      await deleteLocalForm(local.client_id)
    }
    queueChanged()
  } catch {
    // offline or flaky connection: the local cache stays authoritative
  }
}

// Pulls a single form into IndexedDB, for the results/completion flows that
// need one record rather than the whole set seedFromServer reconciles. Same
// guards: a queued or dirty local copy is never clobbered by the server pull.
export async function hydrateForm(clientId, { signal } = {}) {
  if (!signedIn() || !navigator.onLine) return false

  try {
    const response = await fetch(`/api/forms/${clientId}`, { headers: { Accept: "application/json" }, signal })
    if (!response.ok) return false
    const serverForm = (await response.json()).form
    if (!serverForm) return false

    const pending = (await queueEntries()).some((entry) => entry.form_client_id === clientId)
    const local = await getForm(clientId)
    if (pending || (local && local.dirty)) return false

    await applyServerForm(serverForm)
    queueChanged()
    return true
  } catch {
    return false
  }
}

export async function syncNow() {
  if (syncing || paused || !signedIn() || !navigator.onLine) return
  syncing = true
  notify("started")

  try {
    let synced = 0
    for (const entry of await queueEntries()) {
      const done = await pushEntry(entry)
      if (!done) break
      synced++
    }
    localStorage.setItem("predium:last_sync", new Date().toISOString())
    notify("finished", { synced, pending: await pendingCount() })
  } finally {
    syncing = false
  }
}

async function pushEntry(entry, force = false) {
  const snapshot = await snapshotForm(entry.form_client_id)
  if (!snapshot) {
    await dequeue(entry.id)
    return true
  }
  const { form, responses } = snapshot

  let response
  try {
    response = await fetch(`/api/forms/${form.client_id}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(),
        Accept: "application/json"
      },
      body: JSON.stringify(buildPayload(form, responses, force))
    })
  } catch (error) {
    await markAttempt(entry.id, error)
    notify("offline")
    return false
  }

  if (response.ok) {
    const payload = await response.json()
    if (payload.deleted) {
      await deleteLocalForm(form.client_id)
      notify("deleted", { name: form.name })
    } else {
      await acknowledgePush(form, payload.form, entry.id)
    }
    return true
  }

  if (response.status === 409) {
    return handleConflict(entry, form, (await response.json()).conflict)
  }

  if (response.status === 401) {
    paused = true
    notify("needs_login")
    return false
  }

  await markAttempt(entry.id, `HTTP ${response.status}`)
  notify("error", { httpStatus: response.status, name: form.name })
  return response.status === 422 ? true : false
}

function buildPayload(form, responses, force) {
  const attributes = {}
  FARM_FIELDS.forEach((field) => { attributes[field] = form[field] ?? null })
  attributes.system_types = form.system_types || []

  return {
    form: attributes,
    responses,
    base_updated_at: form.base_updated_at || null,
    force
  }
}

// ADR-3 conflict matrix (KTD-7): completed takes the server copy silently
// (with a notification), drafts ask the user.
async function handleConflict(entry, form, conflict) {
  if (conflict.reason === "completed") {
    await applyServerForm(conflict.form)
    await dequeue(entry.id)
    notify("conflict_completed", { name: form.name })
    return true
  }

  const choice = await askUser(form, conflict.form)
  if (choice === "keep") {
    await rebaseForm(form.client_id, conflict.form.updated_at)
    return pushEntry(entry, true)
  }
  if (choice === "server") {
    await applyServerForm(conflict.form)
    await dequeue(entry.id)
    notify("conflict_resolved", { name: form.name })
    // The open editor still holds the discarded local values in memory; reload
    // so it re-reads the server version the user just chose.
    window.Turbo?.visit(window.location.href, { action: "replace" })
    return true
  }
  // dialog unavailable (page without the partial): leave the entry queued
  return false
}

function askUser(localForm, serverForm) {
  return new Promise((resolve) => {
    const event = new CustomEvent("predium:conflict", {
      detail: { local: localForm, server: serverForm, resolve }
    })
    document.dispatchEvent(event)
    if (!event.detail.handled) resolve(null)
  })
}

export function resumeAfterLogin() {
  paused = false
}

// Global triggers, registered once per page load.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => syncNow())
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow()
  })
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data === "predium:sync") syncNow()
  })
}
