---
title: "Offline sync race: false 409 conflicts and lost in-flight edits"
date: 2026-09-10
category: logic-errors
module: offline_sync
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - "Two rapid edits to a brand-new form produce a spurious HTTP 409 Conflict dialog on the user's own draft"
  - "Both PUTs to /api/forms/:client_id carry base_updated_at: nil, so the second is rejected as stale"
  - "A successful push can silently discard edits made while the PUT was in flight"
  - "Navbar pending-sync badge stays stuck after a completed push"
root_cause: async_timing
resolution_type: code_fix
severity: high
related_components:
  - app/javascript/lib/db.js
  - app/javascript/lib/sync.js
tags: [offline-first, dexie, indexeddb, sync-conflict, pwa]
---

# Offline sync race: false 409 conflicts and lost in-flight edits

## Problem

In the offline-first sync layer, two rapid edits to a brand-new draft made the client's second upsert arrive at the server with `base_updated_at: nil` after the first upsert had already created the record. The server's optimistic-concurrency check (`app/services/forms/sync_upsert.rb:80-81`, blank base is treated as stale) correctly returned 409, so the user saw a sync-conflict dialog on their own draft that no other device had ever touched. A second, quieter defect sat underneath: a successful push replaced the local IndexedDB record wholesale, silently discarding any edit made while that push was in flight.

## Symptoms

- A translated "sync conflict" dialog ("Conflicto de sincronizacion") appearing on a form the user just created, after typing in two fields quickly (name, then national ID).
- Server log signature: two `PUT /api/forms/:client_id` requests moments apart, both carrying `"base_updated_at"=>nil`; the first completes `200 OK` (creates the record), the second completes `409 Conflict`.
- Secondary symptom: the navbar pending badge stuck at "1 pendientes" after a confirmed-successful sync with an empty queue. Same underlying racing-async pattern, different surface: a slow `pendingCount()` read started at pending=1 could resolve after the pending=0 read and repaint stale state.

## What Didn't Work

**Round 0 (original implementation).** `pushEntry` handled a successful response with an unconditional `applyServerForm(payload.form)`, which does a full `db.forms.put` of the server copy with `dirty: 0` (`app/javascript/lib/db.js:128-165`). Any edit made between payload build and response arrival was overwritten by the server copy, and its queue entry was dequeued. This both lost data and left later pushes with whatever base the server copy carried.

**Round 1 (looked correct, still failed browser QA).** The fix added an in-flight check to `pushEntry`: refetch the local record after the response, and when its `updated_at` differs from the one the payload was built from, keep the local values and the queue entry, recording only the new server base via `markSynced` (`app/javascript/lib/sync.js:108-117`, `app/javascript/lib/db.js:168-173`). Unit-level reasoning said this closed the window. The browser re-test reproduced the 409 anyway, with the same two-nil-PUTs log signature. The missed link: the editor holds a long-lived in-memory copy of the form (`this.form`, loaded once at `app/javascript/controllers/form_editor_controller.js:36`) and persists every subsequent edit through `saveForm`, which at that point did a raw full-record `db.forms.put(record)`. The in-memory copy had no `base_updated_at` field, so the very next keystroke's save erased the base that `markSynced` had just recorded, and the following push went out with `nil` again.

Diagnosis came from browser-level QA against the dev server log, not from specs; a request spec cannot exercise a client-side IndexedDB race.

## Solution

Make the storage layer own the sync metadata: `saveForm` now merges the newest `base_updated_at` and `synchronized_at` from the stored row before writing, so a caller's stale in-memory copy can never wipe them (`app/javascript/lib/db.js:28-44`).

Before:

```js
export async function saveForm(record) {
  record.updated_at = new Date().toISOString()
  record.dirty = 1
  await db.forms.put(record)
  return record
}
```

After (current tree):

```js
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
```

`newest` compares ISO-8601 strings lexicographically and prefers the later one (`app/javascript/lib/db.js:42-44`), so the merge is safe in both directions: it protects a push-recorded base from an editor save, and it keeps a fresher base written by conflict resolution ("keep mine" sets `form.base_updated_at` before re-pushing).

The two supporting pieces from round 1 remain load-bearing: the in-flight comparison in `pushEntry` decides between `applyServerForm` + dequeue (nothing changed during flight) and `markSynced` + keep the queue entry (something did), and `markSynced` is a partial `db.forms.update` touching only `base_updated_at` and `synchronized_at`.

For the badge symptom, `connectivity_controller.js` `refresh()` takes a sequence token before its async `pendingCount()` read and bails if a newer refresh started meanwhile (`app/javascript/controllers/connectivity_controller.js:16-20`), so out-of-order reads cannot repaint stale counts.

Shipped in PR #2 (aliciapaz/predium), which is open and unmerged as of this writing; the fix is on `feature/offline-first-stack`. Note the sync files have evolved since the fix landed (territory-extension pruning and seed-deletion propagation were added later); the line references above are to the current tree.

## Why This Works

The base token (`base_updated_at`) is the client's proof of which server version an edit was built on. The bug family existed because three writers touched the same IndexedDB row with different views of that token: the sync layer (recording it), the editor (holding a copy from before it existed), and conflict resolution (advancing it). Any full-record write from the stalest view destroyed the newer token. Moving the merge into `saveForm` means the token's currency is enforced at the single point every writer goes through, instead of depending on each caller refreshing its in-memory copy at the right moments. With the token preserved, the second rapid-edit push carries the base the first push recorded, the server's staleness check passes, and the 409 never fires.

The conflict machinery only has to defend the single-device in-flight race: simultaneous multi-device draft editing is explicitly out of scope per the offline-first plan, with last-writer-wins as the accepted semantics. (session history)

## Prevention

- Never do a full-record `put` from a long-lived in-memory copy when any other writer records metadata on the same row. Either merge at the storage-layer write (as here), or use partial updates (`db.forms.update`) for the fields you own. Per Dexie's documented `put` semantics, `put` replaces the whole object; fields absent from your copy are deletions (`update` merges).
- Optimistic-concurrency tokens belong to the storage layer, not to callers. If callers can carry the token in their own copies, every caller becomes a potential eraser of it.
- Any async read-then-paint UI handler needs an ordering guard (sequence token or equivalent) when its trigger can fire in bursts; awaited reads are not guaranteed to resolve in dispatch order.
- Regression check is browser-level, not spec-level: with the dev server running, create a form and fill two fields in quick succession. Expect no conflict dialog, no 409 in `log/development.log`, and the second `PUT /api/forms/:client_id` carrying a non-null `base_updated_at`. Request specs cannot reproduce this because the race lives in client-side IndexedDB timing.
- No JS unit-test harness exists for `db.js`/`sync.js` (importmap, no Node build step), and bolting on Jest/Vitest would work against that architecture; the idiomatic path for a durable automated regression here is a Capybara-driven system spec. Until one exists, the manual browser repro above is the check. (session history)
- When a concurrency fix "looks correct" but the symptom persists, list every writer of the contested field and check what view of the data each writes from. Round 1 failed because the fix covered the sync layer's writers but not the editor's.

## Related Issues

- PR #2 (aliciapaz/predium): "Offline-first PWA stack, completed-form locking, first test suite", where this fix shipped.
- Later hardening of the same layer (2026-09-09/10, cross-model adversarial review): logout now purges IndexedDB and the Cache API for signed-out page loads, `seedFromServer` gained a dirty-form guard and a deletion-pruning rule (prune only when absent from the server set AND not dirty AND no queue entry), and choosing the server version in a conflict reloads the editor. The `newest`-merge semantics documented here still hold. (session history)
