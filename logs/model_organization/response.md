The Organization model and migration already exist and match your requirements exactly:

**Model** (`app/models/organization.rb`):
- `has_many :memberships, dependent: :destroy` (plus `has_many :users, through: :memberships`)
- `validates :name, presence: true, uniqueness: true`

**Migration** (`db/migrate/20260214000002_create_organizations.rb`):
- `name` string column with `null: false` constraint
- Unique index on `name` for database-level enforcement

Both follow Telos conventions — the model is focused on persistence, associations, and data integrity with no business logic. Nothing to change here.
