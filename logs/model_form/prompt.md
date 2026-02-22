Generate the model Form with migration.\n\nFields: name:string, national_id:string, gender:integer, territory_key:string, state:string, latitude:float, longitude:float, system_types:text, land_area:float, country:string, region:string, locality:string, observations:text, work_force:integer, date_of_birth:date, phone:string, completed_at:datetime, synchronized_at:datetime, discarded_at:datetime.\n\nAssociations: belongs_to :user, has_many :formresponses.\n\nValidations: validates :name, presence: true.\n\nFollow Telos model conventions:
- Focus on persistence, associations, and data integrity only
- Validations for database constraints
- Callbacks only for persistence concerns (e.g., before_validation :set_defaults)
- Use store_accessor for JSONB column accessors
- Query scopes for common filters
- NO business logic — move to services
- Max 100 lines per class