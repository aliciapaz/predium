Generate the model FormResponse with migration.\n\nFields: indicator_key:string, value:integer, is_extension:boolean.\n\nAssociations: belongs_to :form.\n\nValidations: validates :indicator_key, presence: true, uniqueness: { scope: :form_id }; validates :value, presence: true, numericality: { in: 1..10, only_integer: true }.\n\nFollow Telos model conventions:
- Focus on persistence, associations, and data integrity only
- Validations for database constraints
- Callbacks only for persistence concerns (e.g., before_validation :set_defaults)
- Use store_accessor for JSONB column accessors
- Query scopes for common filters
- NO business logic — move to services
- Max 100 lines per class