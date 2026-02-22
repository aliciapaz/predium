The model and migration already exist with exactly the fields, associations, validations, and scopes you described:

**Migration** (`db/migrate/20260214000006_create_form_responses.rb`):
- `form_id` reference with foreign key and `null: false`
- `indicator_key:string` with `null: false`
- `value:integer` with `null: false`
- `is_extension:boolean` defaulting to `false`
- Unique composite index on `[:form_id, :indicator_key]`
- Individual indexes on `indicator_key` and `is_extension`

**Model** (`app/models/form_response.rb`):
- `belongs_to :form`
- `validates :indicator_key, presence: true, uniqueness: { scope: :form_id }`
- `validates :value, presence: true, numericality: { in: 1..10, only_integer: true }`
- Scopes: `core` and `territory_extensions` for filtering by `is_extension`

The `Form` model already has `has_many :form_responses, dependent: :destroy` as well. Everything is in place — no changes needed.
