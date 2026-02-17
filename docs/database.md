# Database Schema

> Predium v2 — Full schema specification for PostgreSQL.

---

## Entity Relationship Overview

```
users ─────┬──── profiles        (1:1)
            ├──── forms           (1:many)
            │      └── form_responses  (1:many)
            └──── memberships     (1:many)
                    └── organizations  (many:1)

Active Storage:
  forms ──── photo (1:1 attachment)
  forms ──── pdf   (1:1 attachment)
```

---

## Tables

### users

Authentication and identity. Single table for all user types (replaces separate `users` + `admin_users` from v1).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `email` | string | unique, not null | Devise authenticatable |
| `encrypted_password` | string | not null | Devise authenticatable |
| `first_name` | string | not null | |
| `last_name` | string | not null | |
| `locale` | string | default: `"en"` | User's preferred locale |
| `platform_role` | integer | default: `0` | enum: `regular=0`, `super_admin=1` |
| `reset_password_token` | string | unique | Devise recoverable |
| `remember_created_at` | datetime | | Devise rememberable |
| `confirmation_token` | string | unique | Devise confirmable |
| `confirmed_at` | datetime | | Devise confirmable |
| `confirmation_sent_at` | datetime | | Devise confirmable |
| `invitation_token` | string | unique | devise_invitable |
| `invitation_created_at` | datetime | | devise_invitable |
| `invitation_sent_at` | datetime | | devise_invitable |
| `invitation_accepted_at` | datetime | | devise_invitable |
| `invitation_limit` | integer | | devise_invitable |
| `invitations_count` | integer | default: `0` | devise_invitable |
| `invited_by_type` | string | | devise_invitable (polymorphic) |
| `invited_by_id` | bigint | | devise_invitable (polymorphic) |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

**Indexes:**
- `email` (unique)
- `reset_password_token` (unique)
- `confirmation_token` (unique)
- `invitation_token` (unique)
- `platform_role`

**Devise modules:** `database_authenticatable`, `registerable`, `recoverable`, `rememberable`, `validatable`, `confirmable`, `invitable`

---

### organizations

Grouping entity for users. An organization can have multiple members with different roles.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `name` | string | unique, not null | |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

---

### memberships

Join table between users and organizations. Defines org-level roles.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → users, not null | |
| `organization_id` | bigint | FK → organizations, not null | |
| `role` | integer | default: `0`, not null | enum: `member=0`, `admin=1` |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

**Indexes:**
- `[user_id, organization_id]` (unique) — one membership per user per org
- `user_id`
- `organization_id`
- `role`

---

### profiles

Extended user information. Separated from `users` to keep auth table lean.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → users, not null, unique | |
| `phone` | string | | Generic format, no country restriction |
| `role_name` | string | | Professional role: "Farmer", "Extension Agent", etc. |
| `country` | string | | ISO 3166-1 alpha-2 |
| `region` | string | | State/province/region — free text |
| `locality` | string | | City/commune — free text |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

**Indexes:**
- `user_id` (unique)

**Notes:**
- Location fields are free text, not tied to a specific country's geography hierarchy
- This replaces the hardcoded Chilean `region_id` / `commune_id` from v1

---

### forms

Core diagnosis form. One form per farm visit. Replaces the 100+ column `forms` table from v1 — indicator scores moved to `form_responses`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `user_id` | bigint | FK → users, not null | Creator of the form |
| `name` | string | not null | Farmer or farm name |
| `national_id` | string | | Generic optional ID (replaces Chilean RUT) |
| `date_of_birth` | date | | |
| `phone` | string | | Farm contact phone |
| `gender` | integer | | enum (values TBD per locale norms) |
| `work_force` | integer | | Number of workers |
| `land_area` | decimal(10,2) | | Total farm area in hectares |
| `latitude` | decimal(10,6) | | GPS latitude |
| `longitude` | decimal(10,6) | | GPS longitude |
| `country` | string | | Farm location country |
| `region` | string | | Farm location region |
| `locality` | string | | Farm location locality |
| `system_types` | text[] | default: `[]` | Farming systems (e.g., agroforestry, livestock) |
| `observations` | text | | Free-text notes |
| `state` | string | default: `"draft"` | AASM states: `draft` → `completed` |
| `completed_at` | datetime | | Timestamp when form was completed |
| `synchronized_at` | datetime | | Last successful sync from offline |
| `discarded_at` | datetime | | Soft delete (Discard gem) |
| `territory_key` | string | | Links to territory extension config |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

**Indexes:**
- `user_id`
- `state`
- `discarded_at`
- `[country, region]` (composite)
- `territory_key`
- `completed_at`

**Notes:**
- `state` managed by AASM gem: `draft` → `completed` (one-way transition)
- `discarded_at` used by the Discard gem for soft deletes — `Form.kept` scope excludes discarded records
- `territory_key` matches filenames in `config/questionnaire/extensions/` (e.g., `"chile"`)
- `system_types` is a PostgreSQL array column for multi-select farming system tags

---

### form_responses

Individual indicator scores for a form. Replaces the 80+ indicator columns from v1's flat `forms` table.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigint | PK | |
| `form_id` | bigint | FK → forms, not null | |
| `indicator_key` | string | not null | Matches YAML config key (e.g., `"soil_coverage"`) |
| `value` | integer | not null | Score from 1 to 10 |
| `is_extension` | boolean | default: `false` | `true` for territory-specific indicators |
| `created_at` | datetime | not null | |
| `updated_at` | datetime | not null | |

**Indexes:**
- `[form_id, indicator_key]` (unique) — one response per indicator per form
- `indicator_key`
- `is_extension`

**Notes:**
- `indicator_key` values are stable strings defined in the YAML questionnaire config
- `value` is validated at the model level to be between 1 and 10
- `is_extension` allows queries to easily separate core vs. territory-specific scores
- Core indicators are always present for completed forms; extensions depend on `territory_key`

---

## Active Storage Attachments

Forms use Active Storage for file attachments:

| Model | Attachment | Type | Notes |
|-------|-----------|------|-------|
| Form | `photo` | `has_one_attached` | Optional farm/field photo |
| Form | `pdf` | `has_one_attached` | Generated diagnosis report PDF |

Active Storage creates its own tables (`active_storage_blobs`, `active_storage_attachments`, `active_storage_variant_records`) via its built-in migration.

---

## Associations Summary

```ruby
class User < ApplicationRecord
  has_one :profile, dependent: :destroy
  has_many :forms, dependent: :destroy
  has_many :memberships, dependent: :destroy
  has_many :organizations, through: :memberships
end

class Organization < ApplicationRecord
  has_many :memberships, dependent: :destroy
  has_many :users, through: :memberships
end

class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :organization
end

class Profile < ApplicationRecord
  belongs_to :user
end

class Form < ApplicationRecord
  belongs_to :user
  has_many :form_responses, dependent: :destroy
  has_one_attached :photo
  has_one_attached :pdf
end

class FormResponse < ApplicationRecord
  belongs_to :form
end
```

---

## Migration Notes

**Order of migrations:**
1. `create_users` — includes all Devise and invite columns
2. `create_organizations`
3. `create_memberships` — depends on users + organizations
4. `create_profiles` — depends on users
5. `create_forms` — depends on users
6. `create_form_responses` — depends on forms

**PostgreSQL-specific features used:**
- `text[]` array column for `forms.system_types`
- Standard `bigint` primary keys (Rails 8 default)

**Gems required for schema features:**
- `devise` + `devise_invitable` — user authentication and invitations
- `aasm` — state machine for `forms.state`
- `discard` — soft delete via `forms.discarded_at`

---

## Deferred to v2.1

The following tables are **not** included in the v2.0 schema:

- **`activities`** — Action plan items created after a diagnosis (linked to forms). Will include: `form_id`, `title`, `description`, `priority`, `status`, `due_date`.
- **`territory_configs`** — If territory extensions need database-backed configuration beyond YAML files.
