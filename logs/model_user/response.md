The User model and migration already exist with exactly the fields, associations, and validations you specified:

**Migration** (`db/migrate/20260214000001_create_users.rb`):
- `email:string` (null: false, unique index)
- `encrypted_password:string` (null: false)
- `first_name:string` (null: false)
- `last_name:string` (null: false)
- `locale:string` (default: "en")
- `platform_role:integer` (default: 0, indexed)
- Plus Devise fields (recoverable, rememberable, confirmable, invitable)

**Model** (`app/models/user.rb`):
- `has_one :profile`, `has_many :forms`, `has_many :memberships` (all with `dependent: :destroy`)
- `has_many :organizations, through: :memberships`
- `validates :first_name, presence: true` and `validates :last_name, presence: true`
- `enum :platform_role, { regular: 0, super_admin: 1 }`
- Devise modules configured

Everything is already in place and follows Telos conventions — model is focused on persistence/associations/validations only, under 100 lines, no business logic. No changes needed.
