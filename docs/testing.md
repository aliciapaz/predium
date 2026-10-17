# Testing

How Predium is tested today, and the rules for adding tests. Two suites run in CI on every PR to `main`/`develop`: RSpec for the server, Vitest for `app/javascript/`.

## What goes where

| Behavior | Suite | Location |
|---|---|---|
| Controller actions, auth, authorization, JSON API contract | RSpec request specs | `spec/requests/` |
| Validations, associations, enums, AASM transitions, scopes | RSpec model specs | `spec/models/` |
| Services (`Forms::SyncUpsert`, `Scoring::Calculator`, `QuestionnaireConfig`) | RSpec service specs | `spec/services/` |
| IndexedDB layer, sync queue, conflict handling, config/locale cache, client scoring | Vitest | `spec/javascript/lib/` |
| Stimulus controllers (rendering, events, self-heal, completion flow) | Vitest | `spec/javascript/controllers/` |

If a bug lives in the browser (IndexedDB timing, a controller repainting state, a sync race), it belongs in Vitest. A request spec cannot reproduce it.

## Rules

- **Every bug fix starts with a failing test** in the suite that owns the behavior. Confirm it fails without the fix.
- **The offline invariants in `AGENTS.md` are tested, and new client code that touches them needs tests too:** online reads self-heal on a cache miss, and server-only state changes refresh the local copy.
- **Scoring changes touch both implementations.** `Scoring::Calculator` and `lib/scoring.js` are both pinned to `spec/fixtures/scoring_parity.json`. Change the fixture, then make both suites pass.
- **Known bugs are `it.todo` with a one-line reason**, never a skipped or deleted test. The fix PR turns the todo into a real test.
- **Test behavior, not implementation.** Assert on what IndexedDB, the DOM, the request, or the dispatched event ends up holding, not on which private method ran.

## RSpec conventions

- Request specs are the primary server test type. Prefer them over system specs; there are no system specs yet.
- Sign in with Devise's `sign_in user` (included for request specs via `spec/support/devise.rb`).
- FactoryBot with explicit values (`name { "Test Farm" }`), no Faker. Use `let`/`before`, not fixtures. The one fixture file is the scoring parity JSON.
- Shoulda Matchers for one-line validation and association checks.
- Request specs that render the layout need `tailwind.css`. Run `bin/rails tailwindcss:build` once in a fresh checkout or worktree, or they fail with `Propshaft::MissingAssetError`.
- SimpleCov runs on every `bundle exec rspec` and writes to `coverage/`.

## Vitest conventions

- **Real Dexie, fake IndexedDB.** `spec/javascript/setup.js` loads `fake-indexeddb`, and `dexie` resolves to the vendored build. Seed state through `lib/db` functions instead of mocking `lib/db`, and call `clearDb(db)` from `support/db.js` in `beforeEach`.
- **Imports resolve like the importmap.** `vitest.config.js` maps `lib/*`, `controllers/*`, `dexie` and `chart.js` the same way `config/importmap.rb` does. When you pin a new package, add a matching alias.
- **Mock at the network boundary.** Stub `fetch` with `stubFetch` and `jsonResponse` (`support/fetch.js`). In controller tests, mock `lib/sync` network functions (`syncNow`, `hydrateForm`) rather than the storage layer.
- **Online/offline and session.** Toggle with `vi.spyOn(navigator, "onLine", "get")`. Add the signed-in and CSRF meta tags with `signIn()` and remove them with `resetHead()` (`support/dom.js`).
- **Stimulus controllers.** Use `mount(html, controllers)`, `settle()` and `unmount()` from `support/stimulus.js`. `mount` awaits async `connect()` and fails the test on errors Stimulus would otherwise only log. Build fixture HTML from the real view so targets, values and actions match.
- **Questionnaire and translations.** `support/questionnaire.js` has a small config in the `/api/questionnaire` shape (two principles, indicators only in territory extensions, `coast` extending `andes`) plus `seedQuestionnaire()` and `seedTranslations()`.
- **Module state.** `lib/i18n` keeps the last loaded map in module state (it re-reads IndexedDB on every `load()`), so use `vi.resetModules()` plus dynamic imports when a test needs a fresh copy. `lib/sync` keeps `syncing`/`paused` flags; call `resumeAfterLogin()` in `beforeEach`.
- **Events.** `recordEvents(type)` collects `predium:*` event details. Call `removeListeners()` in `afterEach`, or a conflict handler from one test answers the next.

## Running

```bash
bundle exec rspec                 # server suite
bundle exec rspec spec/requests   # one directory
npm test                          # JS suite
npm run test:watch                # JS suite, watch mode
npm run lint                      # ESLint
```

## Not automated

These are checked by hand in a browser:

- `lib/pwa.js` and the service worker (`app/views/pwa/service-worker.js`): registration, caching strategies, Background Sync, purge on sign-out.
- Real network and browser timing: going offline mid-sync, multiple tabs, actual IndexedDB quota behavior.
- Chart rendering and visual layout.

### Client upgrade checks

- Start with the previous release's cached questionnaire and translations and an unsynced Chile draft. Open the updated editor and confirm retained answers, including `soil_coverage`, survive and all six principles appear.
- Repeat the upgrade offline and with a failed config request. The editor reports unavailable config and preserves the draft until it can fetch the compatible schema.
- Fail one locale request during refresh, then reload online. Its labels recover even when the questionnaire fingerprint already matches. Reload again and use the editor offline to check both cache layers.
- Change a draft's territory while config pruning runs. Answers valid for the resulting territory survive; completed forms stay untouched.
- With a child extension, editor and results badges name each indicator's source territory, including inherited parent questions.
