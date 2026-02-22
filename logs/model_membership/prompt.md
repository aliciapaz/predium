Generate the model Membership with migration.\n\nFields: role:integer.\n\nAssociations: belongs_to :user, belongs_to :organization.\n\nValidations: validates :user_id, uniqueness: { scope: :organization_id }.\n\nFollow Telos model conventions:
- Focus on persistence, associations, and data integrity only
- Validations for database constraints
- Callbacks only for persistence concerns (e.g., before_validation :set_defaults)
- Use store_accessor for JSONB column accessors
- Query scopes for common filters
- NO business logic — move to services
- Max 100 lines per class