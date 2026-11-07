// Without this, Chrome may evict IndexedDB under storage pressure and Safari
// deletes it after seven days without a visit, unsynced answers included.
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
