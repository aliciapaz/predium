# Predium

Offline-first PWA for conducting agroecological farm diagnoses: field agents fill scored questionnaires on-device and sync when connectivity returns. PDF reports are planned but not built yet.

## Tech Stack

`Rails 8.1 | Ruby 4.0 | PostgreSQL | Solid Queue/Cache/Cable | Propshaft | importmap-rails | Turbo + Stimulus | Tailwind CSS`

- **Auth:** `devise` + `devise_invitable`
- **Authorization:** `action_policy`
- **State machine:** `aasm` (on `Form`)
- **Soft delete:** `discard`
- **PDF:** `prawn` + `prawn-table` (installed, not used yet)
- **Deploy:** Kamal + Thruster

## Domain Model

Core entity flow:

```
User -> Form (diagnosis) -> FormResponse (indicator answer)
Organization -> Membership -> User
```

| Domain Area | Models | Notes |
|---|---|---|
| Diagnosis | `Form`, `FormResponse` | `Form` is AASM state machine (Draft -> Completed, one-way) and `Discard::Model`; has `photo`/`pdf` attachments and a `gender` enum |
| Organizations | `Organization`, `Membership` | `Membership` joins users to orgs with a `role` enum (member/admin) |
| Identity | `User`, `Profile` | `User` has Devise modules + `platform_role` enum (regular/super_admin); `Profile` is 1:1 |

See `CONCEPTS.md` for domain vocabulary (Indicator, Territory Extension, Sync Queue, Sync Base, Client ID).

## Directory Layout

```
app/
  controllers/    # thin; admin/, api/, organizations/, forms/ namespaces
  form_builders/  # PrediumFormBuilder: default builder, applies design-system primitives
  models/         # 6 domain models, no concerns
  services/       # forms/sync_upsert, questionnaire_config, scoring/calculator
  policies/       # ActionPolicy: application, admin/base, form, organization
  jobs/           # only ApplicationJob (no background jobs yet)
  mailers/        # devise mailers
  javascript/
    controllers/  # 12 Stimulus controllers
    lib/          # offline-first client layer: db, sync, pwa, i18n, scoring, config_cache
  views/          # server-rendered Slim/ERB
```

## External Integrations

No third-party HTTP APIs. Authentication is fully local via Devise. The only "external" surface is the browser PWA runtime (service worker, IndexedDB) driven from `app/javascript/lib/`.

## Project-Specific Deviations

- **Client-side offline layer (documented exception to "minimal Stimulus").** `app/javascript/lib/` holds real client logic: `db.js` (IndexedDB), `sync.js` (upload queue + conflict resolution), `pwa.js` (service worker), `scoring.js`, `i18n.js`. This is the offline-first trade-off, not general SPA drift. Server stays the source of truth; the client mirrors it for offline use and reconciles via `Api::FormsController` + `Forms::SyncUpsert`.
  - **IndexedDB is not guaranteed to be seeded.** `seedFromServer()` runs only on `window load` (`pwa.js`), which Turbo navigations do not fire, and it races any controller that reads the cache on connect. So any client view that reads IndexedDB **while online must self-heal on a miss** by pulling from the server before showing an "not on this device" state (see `cachedConfig()`, which fetches on miss, and `results_controller`, which seeds when a form is absent). A bare `getForm`/`getResponses` read with no online fallback is a bug: the form can be in Postgres and in the server-rendered list yet absent locally.
  - **Server-only state changes must refresh the local copy.** Endpoints that mutate a form outside the sync-upsert path (e.g. `Forms::CompletionsController#create`, which flips state to completed) leave IndexedDB stale; the caller must `seedFromServer()` (or re-apply the server form) before navigating, or the offline copy diverges.
- **JSON API namespace** (`app/controllers/api/`) exists solely to serve/sync the questionnaire config and forms to the PWA, keyed by device-generated `client_id`, not the standard server-rendered flow.
- **Scoring lives in two places by necessity:** `Scoring::Calculator` (server) and `lib/scoring.js` (client, for offline score preview). Keep them in sync: both are pinned to `spec/fixtures/scoring_parity.json` (RSpec and Vitest).

## Design System

Any change to a view, a Stimulus renderer or a helper that emits markup follows `docs/design-system.md`. The contract:

- Colors, fonts and shadows come from `app/assets/tailwind/tokens.css` only. The default Tailwind palette is reset, so `gray-*`, `rose-*` and the old `earth-*`/`forest-*`/`mustard-*` classes render nothing.
- Build with primitives, not utility piles: `field`, `btn-*`, `chip`, `card`, `badge`, `alert_box`, `icon`/`icon_button`, `score-option`. Forms get `field` automatically from `PrediumFormBuilder`; Stimulus markup uses `lib/ui.js`.
- Persistent screen actions go in one `action-bar`; nothing else is pinned to the bottom.
- Mobile first at 360px, 44px touch targets, 16px text in anything that opens the keyboard.
- Fix defects in the innermost layer (token, primitive, pattern, rule), not on the one screen where they showed up.
- `bin/design-check` must stay clean. It runs on every edit through the `.claude/settings.json` hook, in `bin/ci`, and in CI.

## Architecture Notes

- **Authorization:** ActionPolicy policies for `Form`, `Organization`, and admin area.
- **Presentation:** Server-rendered views; no decorators/view components.
- **Domain Logic:** Thin services orchestrate sync/scoring; `Form` owns its state transitions via AASM.
- **Persistence:** Solid Queue/Cache/Cable on PostgreSQL (no Redis).

## Agent Workflows

- **Tests:** `bundle exec rspec`. Testing rules and conventions for both suites live in `docs/testing.md`.
- **JS tests:** `npm test` (Vitest + jsdom + fake-indexeddb, specs in `spec/javascript/`). `vitest.config.js` mirrors the importmap aliases; `dexie` resolves to the vendored copy.
- **Lint:** `bundle exec rubocop` (Shopify style + Telos AI Harness cops under `Harness/*`; run `bundle exec rubocop --only Harness` for architecture checks)
- **Design check:** `bin/design-check` (tokens, primitives and patterns; see `docs/design-system.md`)
- **JS lint:** `npm run lint` (ESLint flat config in `eslint.config.js`). Node is dev-only: `package.json` holds lint/test tooling, runtime JS still ships through importmap.
- **Security scans:** `bin/brakeman`, `bin/bundler-audit`, `bin/importmap audit`
- **CI:** `.github/workflows/ci.yml` runs RSpec, Brakeman, bundler-audit, importmap audit, RuboCop, and the JS lint + test job; deploys via Kamal.
