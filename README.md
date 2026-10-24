# Predium

Farm diagnosis tool for agroecological transition, based on CET's methodology and developed in
Chile. Field agents score a farm against six agroecology principles (Level 1) and a set of
territory-specific indicators (Level 2), working offline on their phone or tablet. Forms sync
when connectivity returns. PDF reports for completed diagnoses are planned.

- Product site: [prediumapp.org](https://prediumapp.org)
- App: [app.prediumapp.org](https://app.prediumapp.org) (invite-only)

## Stack

Rails 8.1 on Ruby 4.0 and PostgreSQL, with Hotwire (Turbo + Stimulus), Tailwind, and importmap.
The offline layer is a PWA: a service worker plus IndexedDB, in `app/javascript/lib/`. Spanish
is the default locale; English is also supported.

## Getting started

Requirements: Ruby 4.0.0 (see `.ruby-version`), PostgreSQL 16, and Node 22 for JS lint and tests
(Node is dev-only, nothing is bundled).

```bash
bin/setup     # installs gems, creates and seeds the database, starts the server
npm install   # JS lint and test tooling
```

After the first run, start the app with `bin/dev` and open http://localhost:3000.

The seeds create these development accounts, all with password `password`:

| Email | Role |
|-------|------|
| `admin@predium.cl` | Super admin |
| `orgadmin@predium.cl` | Admin of the Tierra Viva organization |
| `member@predium.cl` | Member of Tierra Viva |
| `user@predium.cl` | Independent user, no organization |

## Tests and checks

```bash
bundle exec rspec     # Ruby specs
npm test              # JS specs (Vitest)
bundle exec rubocop   # Ruby lint
npm run lint          # JS lint
bin/brakeman && bin/bundler-audit && bin/importmap audit
```

CI runs all of these on pushes and pull requests to `main` and `develop`. Scoring is implemented
twice (server, and client for offline previews), and both are pinned to
`spec/fixtures/scoring_parity.json`, so a scoring change has to update both sides.

## Documentation

| Doc | What it covers |
|-----|----------------|
| [`AGENTS.md`](AGENTS.md) | Architecture overview, domain model, project conventions |
| [`CONCEPTS.md`](CONCEPTS.md) | Domain vocabulary: Principle, Indicator, Territory Extension, sync states |
| [`docs/architecture.md`](docs/architecture.md) | Architecture decision records |
| [`docs/acceptance-criteria.md`](docs/acceptance-criteria.md) | User stories by feature area |
| [`docs/testing.md`](docs/testing.md) | Testing conventions for both suites |
| [`docs/deployment.md`](docs/deployment.md) | Releases, inviting users, console access, backups |
| [`docs/solutions/`](docs/solutions/) | Write-ups of past bugs and the patterns that fixed them |
