The Form model and migration already exist with all the fields, associations, and validations you specified. Here's what's already in place:

**Model** (`app/models/form.rb`):
- `belongs_to :user` and `has_many :form_responses`
- `validates :name, presence: true`
- Gender enum, AASM state machine, Discard soft-delete
- Scopes: `completed`, `draft`, `by_country`
- Land area numericality validation

**Migration** (`db/migrate/20260214000005_create_forms.rb`):
- All requested fields present (name, national_id, gender, territory_key, state, latitude, longitude, system_types, land_area, country, region, locality, observations, work_force, date_of_birth, phone, completed_at, synchronized_at, discarded_at)
- Indexes on state, discarded_at, country+region, territory_key, completed_at
- Note: `latitude`/`longitude` use `decimal` (precision: 10, scale: 6) instead of `float` — this is better for coordinates as it avoids floating-point precision issues. `land_area` similarly uses `decimal`.

No changes needed — the model and migration already match your specification and follow Telos conventions.
