# Architecture Decision Records

> Predium v2 — Key technical decisions for the ground-up rebuild of PrediApp.

---

## ADR-1: Normalized Responses Instead of Flat Columns

**Status:** Accepted

**Context:**
The original PrediApp stores all indicator scores as 80+ integer columns on a single `forms` table. This creates a fragile schema — adding a new indicator requires a migration, unused territory-specific columns waste storage, and aggregation queries are cumbersome.

**Decision:**
Replace the flat column approach with a `form_responses` join table:

```
form_responses
  form_id       → references forms
  indicator_key → string (e.g. "soil_coverage", "biodiversity")
  value         → integer (1–10)
  is_extension  → boolean (flags territory-specific indicators)
```

A unique index on `[form_id, indicator_key]` enforces one response per indicator per form.

Indicator keys are stable strings that match the YAML questionnaire config (see ADR-2). They do not change when the UI is reworded or translated.

**Consequences:**
- Adding indicators requires only a YAML change, not a migration
- Territory extensions store only their relevant indicators — no wasted columns
- Aggregation queries use `GROUP BY indicator_key` instead of listing column names
- Queries are slightly more complex than reading a single row, mitigated by model scopes and service objects
- Historical data is preserved per-indicator, making longitudinal analysis straightforward

---

## ADR-2: YAML-Driven Questionnaire with Standardized Core

**Status:** Accepted

**Context:**
The questionnaire structure (6 Level-1 categories, 74 Level-2 indicators across 15 dimensions) is the domain heart of the app. It must be:
- Stable enough for cross-territory comparison
- Extensible for territory-specific indicators
- Translatable without touching code

**Decision:**
Define the questionnaire in YAML configuration files:

```
config/questionnaire/
  core.yml                          # 6 L1 + 74 L2 indicators
  extensions/
    chile.yml                       # Chilean-specific indicators
    {territory_key}.yml             # Future territory extensions
```

Each indicator entry contains:

```yaml
- key: "soil_coverage"
  dimension: "soil"
  level: 2
  position: 1
  i18n_key: "questionnaire.soil.soil_coverage"
```

Scoring criteria (low/medium/high descriptions) live in locale files:

```
config/locales/
  en/questionnaire.yml
  es/questionnaire.yml
```

A `QuestionnaireConfig` service loads and caches the YAML at boot, providing lookup methods:

```ruby
QuestionnaireConfig.core_indicators          # all 74 L2 + 6 L1
QuestionnaireConfig.dimensions               # 15 dimensions
QuestionnaireConfig.extension("chile")       # territory-specific indicators
QuestionnaireConfig.indicator("soil_coverage") # single indicator metadata
```

**Consequences:**
- Core indicators are always comparable across territories
- Territory extensions are clearly separated and flagged in responses (`is_extension: true`)
- Adding a territory requires only a new YAML file and locale entries
- The YAML is cached in IndexedDB for offline form creation (see ADR-3)
- Changing indicator text is a locale file change, not a code change

---

## ADR-3: Offline-First with Improved Service Worker + IndexedDB

**Status:** Accepted

**Context:**
PrediApp already uses Workbox + Dexie.js for offline support, but the approach is brittle — questionnaire config is not cached, sync has no conflict detection, and there's no queue for failed syncs.

**Decision:**
Keep the Workbox + Dexie.js foundation but improve the architecture:

**IndexedDB stores (Dexie.js):**
- `forms` — full form data including draft state
- `form_responses` — indicator responses keyed by form
- `questionnaire_config` — cached YAML config for offline form creation
- `locale_data` — cached translations for the active locale
- `sync_queue` — pending changes with timestamps and operation type

**Sync strategy:**
1. All writes go to IndexedDB first, then queue for server sync
2. Background Sync API dispatches queued changes when connectivity returns
3. Manual "Sync Now" button as fallback for browsers without Background Sync
4. Each queued item tracks: `form_id`, `operation` (create/update), `timestamp`, `payload`

**Conflict resolution:**
- **Completed forms:** server wins (authoritative after completion)
- **Drafts:** client wins with user confirmation dialog
- **Deleted forms:** server-side soft delete is authoritative
- Conflicts surface a notification so the user is always aware

**Cache strategy (Workbox):**
- App shell (HTML, CSS, JS): cache-first with network update
- Questionnaire YAML and locale files: stale-while-revalidate
- API responses: network-first with cache fallback
- Images/assets: cache-first

**Consequences:**
- Forms can be created, edited, and viewed entirely offline
- Sync is reliable with queue-based retry
- Users see a clear offline/online indicator in the UI
- Full questionnaire config available offline — no blank forms
- Slightly more complex client-side code, but contained in dedicated Stimulus controllers

---

## ADR-4: Prawn for Self-Hosted PDF Generation

**Status:** Accepted

**Context:**
PrediApp uses PDFShift, an external API, to generate diagnosis PDFs. This adds a third-party dependency, costs per-PDF, and fails when the service is down.

**Decision:**
Replace PDFShift with Prawn (Ruby PDF library) for fully self-hosted generation.

**Architecture:**
```ruby
# app/services/pdf_generators/diagnosis_report.rb
module PdfGenerators
  class DiagnosisReport
    def initialize(form)
      @form = form
    end

    def call
      pdf = Prawn::Document.new(page_size: "LETTER")
      # ... build PDF sections
      pdf.render
    end
  end
end
```

**PDF sections:**
1. Header with farm info (name, location, date)
2. Radar/spider chart for L1 scores (embedded as PNG)
3. Dimension-level bar charts for L2 scores
4. Score table with indicator details
5. Footer with generation date

**Chart embedding:**
- Vega-Lite specs rendered to PNG server-side via `vl2png` (Node CLI)
- Alternatively, client pre-renders charts to base64 PNG and sends with form data
- PNGs embedded in Prawn document via `image StringIO.new(png_data)`

**Generation flow:**
1. User clicks "Generate PDF"
2. Controller enqueues `PdfGenerationJob`
3. Job calls `PdfGenerators::DiagnosisReport.new(form).call`
4. Result attached to form via Active Storage
5. User notified via Turbo Stream when ready

**Consequences:**
- Zero external dependencies for PDF generation
- PDFs generated in background — no blocking requests
- Full control over layout and styling
- Activity plan PDFs deferred to v2.1 (separate generator)

---

## ADR-5: Vega-Lite for All Visualizations

**Status:** Accepted

**Context:**
PrediApp uses Highcharts for client-side charts. Highcharts requires a commercial license for non-personal use. The admin panel already uses Vega for some visualizations.

**Decision:**
Standardize on Vega-Lite for all charts (client and PDF).

**Client-side rendering:**
- A `chart` Stimulus controller accepts a Vega-Lite JSON spec via `data-chart-spec-value`
- The controller renders the chart using the `vega-embed` library
- Data is injected server-side into the spec before rendering

**Chart types needed:**
| Chart | Use | Vega-Lite Mark |
|-------|-----|---------------|
| Radar/Spider | L1 overview | Arc + line (custom composite) |
| Bar (horizontal) | L2 dimension scores | `bar` |
| Grouped bar | Comparison across forms | `bar` with color encoding |

**Server-side rendering (for PDF):**
- `vl2png` Node CLI converts Vega-Lite spec → PNG
- Called from Ruby via `Open3.capture2` with the spec as stdin
- PNGs cached in tmp/ during PDF generation

**Consequences:**
- Single charting library across client and server
- Open-source, no licensing concerns
- Vega-Lite specs are declarative JSON — easy to test and version
- Radar chart requires a composite spec (not a native Vega-Lite mark), but this is a solved pattern
- Node.js required on the server for `vl2png` (already needed for asset compilation)

---

## ADR-6: Rails 8.1 with Kamal Deployment

**Status:** Accepted

**Context:**
The original app runs on Rails 7 with Sprockets and Sidekiq. Rails 8 introduces Solid Queue, Solid Cache, and Solid Cable — eliminating the Redis dependency for background jobs and caching.

**Decision:**
Build on Rails 8.1 with the new defaults:

| Component | Original | New |
|-----------|----------|-----|
| Background jobs | Sidekiq + Redis | Solid Queue (database-backed) |
| Caching | Redis | Solid Cache (database-backed) |
| Action Cable | Redis | Solid Cable (database-backed, if needed) |
| Asset pipeline | Sprockets | Propshaft |
| JS bundling | Importmap | Importmap (unchanged) |
| Deployment | Manual/Capistrano | Kamal |

**Consequences:**
- No Redis dependency — simpler infrastructure, lower cost
- Solid Queue is the Rails 8 default — well-supported, good enough for our volume
- Propshaft is simpler than Sprockets — no asset compilation pipeline, just file serving with digests
- Importmap works well with Stimulus — no Node.js build step for JS (Node only needed for `vl2png`)
- Kamal handles Docker-based deployment with zero-downtime deploys
- See `docs/deployment.md` for full Kamal configuration

---

## ADR-7: I18n Approach

**Status:** Accepted

**Context:**
PrediApp is Spanish-only with hardcoded strings in views. Predium v2 must support English and Spanish, with the architecture to add more locales.

**Decision:**
Full Rails I18n with structured locale files:

```
config/locales/
  en.yml                    # UI strings (nav, buttons, flash messages)
  es.yml
  en/
    questionnaire.yml       # Indicator labels, descriptions, scoring criteria
    devise.yml              # Authentication messages
  es/
    questionnaire.yml
    devise.yml
```

**Key conventions:**
- All Slim templates use `t()` helper exclusively — no hardcoded strings
- Default locale: `:en`
- Available locales: `[:en, :es]`
- Locale set per-user (stored in `users.locale` column)
- Locale detected from: user preference → browser `Accept-Language` → default
- URL prefix not used (locale is a user setting, not a route concern)

**Offline translations:**
- A `TranslationsController#show` endpoint serves the current locale's flat JSON
- Cached in IndexedDB alongside questionnaire config
- Stimulus controllers use a lightweight `I18n.t()` helper for client-side strings

**Consequences:**
- Clean separation of content and code
- Adding a locale requires only new YAML files
- Questionnaire translations are versioned alongside the config
- Offline mode has full translation support
- No URL-based locale switching simplifies routing

---

## ADR-8: Unified User Model with Role-Based Access

**Status:** Accepted

**Context:**
PrediApp has separate `users` and `admin_users` tables with independent Devise sessions. Organization admins must maintain two accounts. The `organization_admin_users` join table adds a third layer of complexity.

**Decision:**
Single `users` table with two access dimensions:

**Platform role** (on the user record):
```ruby
enum :platform_role, { regular: 0, super_admin: 1 }
```

**Organization role** (on the membership record):
```ruby
enum :role, { member: 0, admin: 1 }
```

**Effective roles:**

| Role | How | Access |
|------|-----|--------|
| Super Admin | `user.platform_role == :super_admin` | Platform-level: manage all orgs, users, global settings |
| Org Admin | `membership.role == :admin` | Org-level: manage org, invite members, view org reports |
| Org Member | `membership.role == :member` | Create/manage own forms within the org |
| Independent | User with no memberships | Create forms independently, no org context |

**Authorization:**
- ActionPolicy checks `super_admin?` or `org_admin?(organization)` in policies
- Single Devise session — no separate admin login
- Admin panel routes protected by policy checks, not separate authentication

**Consequences:**
- One account, one login — simpler UX
- A user can belong to multiple organizations with different roles
- Eliminates `admin_users` and `organization_admin_users` tables
- Role checks are explicit in policies — no ambient authority
- Migration from v1 requires merging admin/user accounts where emails match
