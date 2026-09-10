import Dexie from "dexie"

// The five ADR-3 stores. Forms are keyed by client_id (KTD-3), which is also
// the URL param and the sync idempotency key.
export const db = new Dexie("predium")

db.version(1).stores({
  forms: "client_id, state, updated_at",
  form_responses: "[form_client_id+indicator_key], form_client_id",
  questionnaire_config: "id",
  locale_data: "locale",
  sync_queue: "++id, form_client_id, queued_at"
})

export function newClientId() {
  return crypto.randomUUID()
}

export async function getForm(clientId) {
  return db.forms.get(clientId)
}

export async function listForms() {
  const forms = await db.forms.toArray()
  return forms.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
}

export async function saveForm(record) {
  // Callers hold long-lived in-memory copies; a raw put would wipe the sync
  // metadata a concurrent push just recorded. Keep the newest of each side.
  const existing = await db.forms.get(record.client_id)
  if (existing) {
    record.base_updated_at = newest(record.base_updated_at, existing.base_updated_at)
    record.synchronized_at = newest(record.synchronized_at, existing.synchronized_at)
  }
  record.updated_at = new Date().toISOString()
  record.dirty = 1
  await db.forms.put(record)
  return record
}

function newest(a, b) {
  return [a, b].filter(Boolean).sort().pop() ?? null
}

export async function getResponses(formClientId) {
  const rows = await db.form_responses.where({ form_client_id: formClientId }).toArray()
  const map = {}
  rows.forEach((row) => { map[row.indicator_key] = row.value })
  return map
}

export async function saveResponse(formClientId, indicatorKey, value, isExtension = false) {
  await db.form_responses.put({
    form_client_id: formClientId,
    indicator_key: indicatorKey,
    value: Number(value),
    is_extension: isExtension
  })
  await db.forms.update(formClientId, { updated_at: new Date().toISOString(), dirty: 1 })
}

// Drops extension responses no longer allowed by the form's territory so a
// territory change cannot leave keys the server will reject with 422 forever.
export async function pruneStaleExtensions(formClientId, allowedKeys) {
  const allowed = new Set(allowedKeys)
  await db.form_responses
    .where({ form_client_id: formClientId })
    .and((row) => row.is_extension && !allowed.has(row.indicator_key))
    .delete()
  await db.forms.update(formClientId, { updated_at: new Date().toISOString(), dirty: 1 })
}

export async function getConfig() {
  return db.questionnaire_config.get("core")
}

export async function putConfig(config) {
  await db.questionnaire_config.put({ id: "core", ...config })
}

export async function getLocale(locale) {
  return db.locale_data.get(locale)
}

export async function putLocale(locale, translations, fingerprint) {
  await db.locale_data.put({ locale, translations, fingerprint })
}

// One queue entry per form: repeated edits collapse into a single upsert
// whose payload is built from the current store state at drain time.
export async function enqueue(formClientId) {
  const existing = await db.sync_queue.where({ form_client_id: formClientId }).first()
  if (existing) {
    await db.sync_queue.update(existing.id, { queued_at: new Date().toISOString() })
  } else {
    await db.sync_queue.add({
      form_client_id: formClientId,
      operation: "upsert",
      queued_at: new Date().toISOString(),
      attempts: 0,
      last_error: null
    })
  }
  queueChanged()
}

export async function dequeue(entryId) {
  await db.sync_queue.delete(entryId)
  queueChanged()
}

export async function markAttempt(entryId, error) {
  const entry = await db.sync_queue.get(entryId)
  if (!entry) return
  await db.sync_queue.update(entryId, { attempts: (entry.attempts || 0) + 1, last_error: String(error) })
}

export async function queueEntries() {
  return db.sync_queue.orderBy("queued_at").toArray()
}

export async function pendingCount() {
  return db.sync_queue.count()
}

// Replaces the local copy with the server's authoritative version.
export async function applyServerForm(serverForm) {
  await db.transaction("rw", db.forms, db.form_responses, async () => {
    await db.forms.put({
      client_id: serverForm.client_id,
      name: serverForm.name,
      national_id: serverForm.national_id,
      date_of_birth: serverForm.date_of_birth,
      phone: serverForm.phone,
      gender: serverForm.gender,
      work_force: serverForm.work_force,
      land_area: serverForm.land_area,
      latitude: serverForm.latitude,
      longitude: serverForm.longitude,
      country: serverForm.country,
      region: serverForm.region,
      locality: serverForm.locality,
      observations: serverForm.observations,
      territory_key: serverForm.territory_key,
      system_types: serverForm.system_types || [],
      state: serverForm.state,
      completed_at: serverForm.completed_at,
      synchronized_at: serverForm.synchronized_at,
      base_updated_at: serverForm.updated_at,
      updated_at: serverForm.updated_at,
      dirty: 0
    })
    await db.form_responses.where({ form_client_id: serverForm.client_id }).delete()
    for (const response of serverForm.responses || []) {
      await db.form_responses.put({
        form_client_id: serverForm.client_id,
        indicator_key: response.indicator_key,
        value: response.value,
        is_extension: response.is_extension
      })
    }
  })
}

// Records a successful push without touching local field values, for forms
// edited again while the push was in flight.
export async function markSynced(clientId, serverForm) {
  await db.forms.update(clientId, {
    base_updated_at: serverForm.updated_at,
    synchronized_at: serverForm.synchronized_at
  })
}

export async function deleteLocalForm(clientId) {
  await db.transaction("rw", db.forms, db.form_responses, db.sync_queue, async () => {
    await db.forms.delete(clientId)
    await db.form_responses.where({ form_client_id: clientId }).delete()
    await db.sync_queue.where({ form_client_id: clientId }).delete()
  })
  queueChanged()
}

export function queueChanged() {
  document.dispatchEvent(new CustomEvent("predium:queue-changed"))
}
