---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
title: "feat: Targeted single-form hydration for offline results/editor"
date: 2026-09-10
depth: lightweight
---

# feat: Targeted single-form hydration for offline results/editor

**Target repo:** predium
**Base branch:** `fix/results-seed-on-cache-miss` (stacked; #8 not yet merged into `develop`)

## Summary

The results page and the completion flow currently repair or refresh a single
form by calling `seedFromServer()`, which fetches the entire `/api/forms` set
via `Api::FormsController#index`. That is wasteful for field agents on slow
connections when only one form needs to be pulled. Add a targeted
`GET /api/forms/:client_id` endpoint and a `hydrateForm(clientId)` client helper,
then switch both call sites to it.

## Problem Frame

`seedFromServer()` (`app/javascript/lib/sync.js`) pulls every form for the user
and reconciles the local set. Two callers only ever need one form:

- `results_controller.js` heals a single missing form on a cache miss (added in
  `fix/results-seed-on-cache-miss`).
- `form_editor_controller.js` refreshes one just-completed form after `/completion`.

Both pay for a full-set fetch to touch one record. A single-form fetch is the
right-sized primitive and keeps the offline-first "server is source of truth"
reconciliation intact for just that record.

## Requirements

- **R1.** `GET /api/forms/:client_id` returns the serialized form for the
  authenticated user, using the same shape as the index (`serialize_form`).
- **R2.** The endpoint returns 404 when the `client_id` does not exist among the
  current user's kept forms, including when it belongs to another user.
- **R3.** A `hydrateForm(clientId)` helper fetches that endpoint and applies the
  server form to IndexedDB, honoring the same dirty/pending guards
  `seedFromServer` uses, and reports whether a form was applied.
- **R4.** `results_controller` and `form_editor_controller` use `hydrateForm`
  instead of `seedFromServer` for their single-form needs.

## Key Technical Decisions

- **No service object.** Per Telos standards a one-line scoped lookup belongs in
  the thin controller, not a service. `current_user.forms.find_by(client_id:)`
  with an explicit 404 render.
- **Reuse `serialize_form`.** No new serializer; identical payload shape to the
  index so `applyServerForm` needs no changes.
- **Explicit 404, not `find_by!`.** Render `{ error: "not_found" }` with
  `status: :not_found` so the JSON client gets a clean status instead of relying
  on a global `RecordNotFound` rescue that may render HTML. `default_scope { kept }`
  plus `current_user.forms` means discarded and other-user forms are already
  out of scope, so both collapse to the same 404.
- **Guard parity in `hydrateForm`.** Mirror `seedFromServer`'s guards: skip apply
  when the form is queued (pending) or locally dirty, so an in-flight local edit
  is never clobbered by the pull.

## Implementation Units

### U1. Add `api/forms#show`

**Goal:** Serve a single serialized form by `client_id`, 404 otherwise.
**Requirements:** R1, R2.
**Files:**
- `config/routes.rb` (add `:show` to the api forms resources)
- `app/controllers/api/forms_controller.rb` (add `show`)

**Approach:** Add `:show` to `resources :forms, only: [:index, :update, :show], param: :client_id`. Add a `show` action that looks up `current_user.forms.find_by(client_id: params[:client_id])`; render `serialize_form(form)` when found, else render a 404 JSON body. Reuse the existing private `serialize_form`. Keep the action within the 30-50 line controller budget (it is ~4 lines).

**Patterns to follow:** existing `index`/`update` actions and `serialize_form` in the same controller; 401 handling already provided by `Api::BaseController`.

**Test scenarios:** covered by U4 (request spec). No standalone test file for the controller beyond the request spec.

### U2. Add `hydrateForm(clientId)` to the sync layer

**Goal:** Targeted single-form pull into IndexedDB with guard parity.
**Requirements:** R3.
**Dependencies:** U1.
**Files:**
- `app/javascript/lib/sync.js`

**Approach:** Add an exported `hydrateForm(clientId)`. Return `false` early when not signed in or offline. `fetch("/api/forms/" + clientId, { headers: { Accept: "application/json" } })`; on a non-ok response (including 404) return `false`. On success, apply the same guards `seedFromServer` uses: skip (return `false`) when the client_id is in the sync queue (pending) or when the local form exists and is `dirty`. Otherwise `applyServerForm(serverForm)` and return `true`. Wrap the fetch in try/catch and return `false` on network failure, matching `seedFromServer`'s offline tolerance.

**Patterns to follow:** `seedFromServer` in the same file (queue/pending set construction, dirty check, `applyServerForm`, try/catch).

**Test scenarios:** `Test expectation: none -- no JS test harness in this repo (importmap, no package.json); behavior is exercised through the Rails request spec for the endpoint (U4) and manual verification.`

### U3. Switch both call sites to `hydrateForm`

**Goal:** Replace the full-set fetch at the two single-form call sites.
**Requirements:** R4.
**Dependencies:** U2.
**Files:**
- `app/javascript/controllers/results_controller.js`
- `app/javascript/controllers/form_editor_controller.js`

**Approach:** In `results_controller.connect()`, on the cache-miss-when-online branch, call `await hydrateForm(this.clientIdValue)` instead of `seedFromServer()`, then re-read `getForm`. In `form_editor_controller` completion handler, replace the post-`/completion` `seedFromServer()` with `await hydrateForm(this.clientId)`. Update imports: results_controller imports `hydrateForm` from `lib/sync` (drop the now-unused `seedFromServer` import there); form_editor_controller swaps `seedFromServer` for `hydrateForm` in its `lib/sync` import (keep `syncNow`, `csrfToken`). Leave `seedFromServer` exported and still used by `pwa.js`.

**Patterns to follow:** existing import lines and call sites changed in `fix/results-seed-on-cache-miss`.

**Test scenarios:** `Test expectation: none -- JS wiring change, no test harness; covered by manual verification (U4 covers the endpoint).`

### U4. Request spec for `api/forms#show`

**Goal:** Lock the endpoint contract.
**Requirements:** R1, R2.
**Dependencies:** U1.
**Files:**
- `spec/requests/api/forms_spec.rb` (add a `GET /api/forms/:client_id` describe block; file already exists)

**Approach:** Add a describe/context block for `show` alongside the existing index/update coverage. Use the existing factories and sign-in helper pattern already in the file.

**Test scenarios:**
- Happy path: signed-in user requests their own form by `client_id` → 200 with the serialized form (assert `client_id`, `state`, and that `responses` are present, matching the index serialization).
- Not found: signed-in user requests a `client_id` that does not exist → 404.
- Other user's form: signed-in user requests a form belonging to a different user → 404 (not 200, not 403; scoped-away is indistinguishable from missing).
- (If the file's existing pattern covers it cheaply) unauthenticated request → 401 from `Api::BaseController`.

## Scope Boundaries

In scope: the endpoint, the client helper, the two call-site swaps, the request spec.

### Deferred to Follow-Up Work

- Retargeting this PR's base from `fix/results-seed-on-cache-miss` to `develop`
  once #8 merges.

Out of scope: changing `seedFromServer` itself (still used on `window load` in
`pwa.js`), any change to `applyServerForm`, offline behavior of the results page
(unchanged: an offline miss still shows the banner).

## Verification Contract

- `bundle exec rspec spec/requests/api/forms_spec.rb` passes, including the new
  show cases.
- Manual: complete a form, land on results showing it completed immediately;
  open a form present in the DB but not cached locally while online and confirm
  it hydrates (single `/api/forms/:client_id` request in the network tab, not a
  full `/api/forms` fetch).

## Definition of Done

- R1-R4 satisfied.
- Request spec green.
- No AI attribution in commits or PR.
- Both call sites use `hydrateForm`; `seedFromServer` remains for `pwa.js`.
