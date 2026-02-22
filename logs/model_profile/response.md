I need permission to edit the file. The migration and model already exist in this project. Here's what's already in place and what needs to change:

**Migration** (`db/migrate/20260214000004_create_profiles.rb`) — already correct with all fields and a unique index on `user_id`.

**Model** (`app/models/profile.rb`) — needs the uniqueness validation added. The current file is:

```ruby
class Profile < ApplicationRecord
  belongs_to :user
end
```

It should be updated to:

```ruby
class Profile < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true
end
```

That's the only change needed — the `belongs_to :user` association and all migration fields (phone, role_name, country, region, locality) with the unique DB index are already in place. Can you approve the edit so I can apply it?
