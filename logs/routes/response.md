The routes file already has RESTful resources for all six models you mentioned:

| Resource | Routes | Notes |
|---|---|---|
| **Organization** | `resources :organizations, only: [:show]` + full CRUD in `admin` namespace | Show for members, full admin management |
| **User** | Devise routes + `admin/users` (index, show, edit, update) | Auth via Devise, admin management |
| **Profile** | `resource :profile, only: [:show, :edit, :update]` | Singular resource (current user's profile) |
| **Membership** | Nested under organizations: `resources :memberships, only: [:index, :destroy]` | Scoped to org context |
| **Form** | `resources :forms` (full CRUD) + nested under orgs | With nested completions and questionnaire_steps |
| **FormResponse** | Handled via `forms/completions` and `forms/questionnaire_steps` | Nested under forms |

The file is 31 lines, well within the 100-line class limit, and follows RESTful conventions. No changes needed — the existing routes already cover the requested resources.
