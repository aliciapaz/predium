The Membership model, migration, and associations already exist in the codebase. Here's what's already in place:

**Model** (`app/models/membership.rb`):
- `belongs_to :user` and `belongs_to :organization`
- `enum :role, { member: 0, admin: 1 }`
- `validates :user_id, uniqueness: { scope: :organization_id }`

**Migration** (`db/migrate/20260214000003_create_memberships.rb`):
- `role` integer column (default: 0, not null)
- Foreign keys for `user_id` and `organization_id` (both not null)
- Unique composite index on `[user_id, organization_id]`
- Index on `role`

**Associations** on the other side:
- `User` has `has_many :memberships` and `has_many :organizations, through: :memberships`
- `Organization` has `has_many :memberships` and `has_many :users, through: :memberships`

Everything follows Telos conventions — no changes needed.
