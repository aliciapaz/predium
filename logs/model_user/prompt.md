Generate the model User with migration.\n\nFields: email:string, encrypted_password:string, first_name:string, last_name:string, locale:string, platform_role:integer.\n\nAssociations: has_one :profile, has_many :forms, has_many :memberships.\n\nValidations: validates :first_name, presence: true; validates :last_name, presence: true.\n\nFollow Telos model conventions:
- Focus on persistence, associations, and data integrity only
- Validations for database constraints
- Callbacks only for persistence concerns (e.g., before_validation :set_defaults)
- Use store_accessor for JSONB column accessors
- Query scopes for common filters
- NO business logic — move to services
- Max 100 lines per class