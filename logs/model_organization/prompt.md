Generate the model Organization with migration.\n\nFields: name:string.\n\nAssociations: has_many :memberships.\n\nValidations: validates :name, presence: true, uniqueness: true.\n\nFollow Telos model conventions:
- Focus on persistence, associations, and data integrity only
- Validations for database constraints
- Callbacks only for persistence concerns (e.g., before_validation :set_defaults)
- Use store_accessor for JSONB column accessors
- Query scopes for common filters
- NO business logic — move to services
- Max 100 lines per class