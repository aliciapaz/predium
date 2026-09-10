# Predium

Offline-first PWA for conducting agroecological farm diagnoses: field agents fill scored questionnaires on-device, sync when connectivity returns, and generate PDF reports.

## Tech Stack

`Rails 8.1 | Ruby 4.0 | PostgreSQL | Solid Queue/Cache/Cable | Propshaft | importmap-rails | Turbo + Stimulus | Tailwind CSS`

- **Auth:** `devise` + `devise_invitable`
- **Authorization:** `action_policy`
- **State machine:** `aasm` (on `Form`)
- **Soft delete:** `discard`
- **PDF:** `prawn` + `prawn-table`
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
- **JSON API namespace** (`app/controllers/api/`) exists solely to serve/sync the questionnaire config and forms to the PWA, keyed by device-generated `client_id`, not the standard server-rendered flow.
- **Scoring lives in two places by necessity:** `Scoring::Calculator` (server) and `lib/scoring.js` (client, for offline score preview). Keep them in sync.

## Architecture Notes

- **Authorization:** ActionPolicy policies for `Form`, `Organization`, and admin area.
- **Presentation:** Server-rendered views; no decorators/view components.
- **Domain Logic:** Thin services orchestrate sync/scoring; `Form` owns its state transitions via AASM.
- **Persistence:** Solid Queue/Cache/Cable on PostgreSQL (no Redis).

## Agent Workflows

- **Tests:** `bundle exec rspec`
- **Lint:** `bundle exec rubocop` (Shopify style + Telos AI Harness cops under `Harness/*`; run `bundle exec rubocop --only Harness` for architecture checks)
- **Security scans:** `bin/brakeman`, `bin/bundler-audit`, `bin/importmap audit`
- **CI:** `.github/workflows/ci.yml` runs RSpec, Brakeman, bundler-audit, importmap audit, and RuboCop; deploys via Kamal.
