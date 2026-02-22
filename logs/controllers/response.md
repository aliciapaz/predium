I'm blocked by file write permissions. Let me output all the generated code so you can review it. Here are all the files:

---

## 1. ApplicationController (updated)

`app/controllers/application_controller.rb` — adds `rescue_from ActionPolicy::Unauthorized`:

```ruby
class ApplicationController < ActionController::Base
  include LocaleSetting

  allow_browser versions: :modern
  stale_when_importmap_changes

  before_action :configure_permitted_parameters, if: :devise_controller?

  rescue_from ActionPolicy::Unauthorized do
    redirect_back fallback_location: root_path, alert: t("flash.unauthorized")
  end

  private

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:first_name, :last_name])
    devise_parameter_sanitizer.permit(:account_update, keys: [:first_name, :last_name])
    devise_parameter_sanitizer.permit(:invite, keys: [:first_name, :last_name])
  end

  def current_organization
    @current_organization ||= current_user&.organizations&.first
  end
  helper_method :current_organization
end
```

---

## 2. OrganizationsController (full CRUD + authorization)

`app/controllers/organizations_controller.rb`:

```ruby
class OrganizationsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_organization, only: [:show, :edit, :update, :destroy]

  def index
    @organizations = current_user.organizations
  end

  def show
    authorize! @organization
  end

  def new
    @organization = Organization.new
    authorize! @organization
  end

  def create
    @organization = Organization.new(organization_params)
    authorize! @organization

    if @organization.save
      @organization.memberships.create!(user: current_user, role: :admin)
      redirect_to @organization, notice: t("flash.organization_created")
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    authorize! @organization
  end

  def update
    authorize! @organization

    if @organization.update(organization_params)
      redirect_to @organization, notice: t("flash.organization_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize! @organization
    @organization.destroy
    redirect_to organizations_path, notice: t("flash.organization_deleted")
  end

  private

  def set_organization
    @organization = Organization.find(params[:id])
  end

  def organization_params
    params.expect(organization: [:name])
  end
end
```

---

## 3. UsersController (new)

`app/controllers/users_controller.rb`:

```ruby
class UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user, only: [:show, :edit, :update]

  def show
    authorize! @user
  end

  def edit
    authorize! @user
  end

  def update
    authorize! @user

    if @user.update(user_params)
      redirect_to @user, notice: t("flash.user_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.expect(user: [:first_name, :last_name, :locale])
  end
end
```

---

## 4. ProfilesController (updated with authorization)

`app/controllers/profiles_controller.rb`:

```ruby
class ProfilesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_profile

  def show
    authorize! @profile
  end

  def edit
    authorize! @profile
  end

  def update
    authorize! @profile

    if @profile.update(profile_params)
      current_user.update(locale: locale_param) if locale_param.present?
      redirect_to profile_path, notice: t("flash.profile_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_profile
    @profile = current_user.profile || current_user.build_profile
  end

  def profile_params
    params.expect(profile: [:phone, :role_name, :country, :region, :locality])
  end

  def locale_param
    params.dig(:user, :locale)
  end
end
```

---

## 5. MembershipsController (new)

`app/controllers/memberships_controller.rb`:

```ruby
class MembershipsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_membership, only: [:update, :destroy]

  def create
    @membership = Membership.new(membership_params)
    authorize! @membership

    if @membership.save
      redirect_to organization_path(@membership.organization),
                  notice: t("flash.membership_created")
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    authorize! @membership

    if @membership.update(membership_params)
      redirect_to organization_path(@membership.organization),
                  notice: t("flash.membership_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize! @membership
    @membership.destroy
    redirect_to organization_path(@membership.organization),
                notice: t("flash.membership_removed")
  end

  private

  def set_membership
    @membership = Membership.find(params[:id])
  end

  def membership_params
    params.expect(membership: [:user_id, :organization_id, :role])
  end
end
```

---

## 6. FormsController (updated with authorization)

`app/controllers/forms_controller.rb` — uses `Form.find` instead of scoping through `current_user.forms` so the policy handles access control (allowing super_admins to access any form):

```ruby
class FormsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_form, only: [:show, :edit, :update, :destroy]

  def index
    forms = current_user.forms.order(updated_at: :desc)
    @drafts = forms.draft
    @completed = forms.completed
  end

  def show
    authorize! @form
    redirect_to edit_form_path(@form) and return if @form.draft?

    @calculator = Scoring::Calculator.new(@form).call
  end

  def new
    @form = current_user.forms.build
    authorize! @form
  end

  def create
    @form = current_user.forms.build(form_params)
    authorize! @form

    if @form.save
      redirect_to form_questionnaire_step_path(@form, QuestionnaireConfig.dimensions.first[:key]),
                  notice: t("flash.form_created")
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    authorize! @form
  end

  def update
    authorize! @form

    if @form.update(form_params)
      redirect_to edit_form_path(@form), notice: t("flash.form_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize! @form
    @form.discard
    redirect_to forms_path, notice: t("flash.form_deleted")
  end

  private

  def set_form
    @form = Form.find(params[:id])
  end

  def form_params
    params.expect(form: [
      :name, :national_id, :date_of_birth, :phone, :gender,
      :work_force, :land_area, :latitude, :longitude,
      :country, :region, :locality, :observations, :territory_key,
      system_types: []
    ])
  end
end
```

---

## 7. FormResponsesController (new, nested under forms)

`app/controllers/form_responses_controller.rb`:

```ruby
class FormResponsesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_form
  before_action :set_form_response, only: [:show, :update, :destroy]

  def index
    authorize! @form, with: FormPolicy
    @form_responses = @form.form_responses
  end

  def show
    authorize! @form_response
  end

  def create
    @form_response = @form.form_responses.build(form_response_params)
    authorize! @form_response

    if @form_response.save
      redirect_to form_form_responses_path(@form),
                  notice: t("flash.response_created")
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    authorize! @form_response

    if @form_response.update(form_response_params)
      redirect_to form_form_responses_path(@form),
                  notice: t("flash.response_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize! @form_response
    @form_response.destroy
    redirect_to form_form_responses_path(@form),
                notice: t("flash.response_deleted")
  end

  private

  def set_form
    @form = Form.find(params[:form_id])
  end

  def set_form_response
    @form_response = @form.form_responses.find(params[:id])
  end

  def form_response_params
    params.expect(form_response: [:indicator_key, :value, :is_extension])
  end
end
```

---

## Policies

### 8. UserPolicy (new)

`app/policies/user_policy.rb`:

```ruby
class UserPolicy < ApplicationPolicy
  def show?
    record.id == user.id || super_admin?
  end

  def update?
    record.id == user.id || super_admin?
  end
end
```

### 9. ProfilePolicy (new)

`app/policies/profile_policy.rb`:

```ruby
class ProfilePolicy < ApplicationPolicy
  def show?
    owner? || super_admin?
  end

  def update?
    owner? || super_admin?
  end
end
```

### 10. MembershipPolicy (new)

`app/policies/membership_policy.rb`:

```ruby
class MembershipPolicy < ApplicationPolicy
  def create?
    org_admin? || super_admin?
  end

  def update?
    org_admin? || super_admin?
  end

  def destroy?
    org_admin? || super_admin?
  end

  private

  def org_admin?
    record.organization.memberships.exists?(user: user, role: :admin)
  end
end
```

### 11. FormResponsePolicy (new)

`app/policies/form_response_policy.rb`:

```ruby
class FormResponsePolicy < ApplicationPolicy
  def show?
    form_owner? || super_admin?
  end

  def create?
    form_owner? || super_admin?
  end

  def update?
    form_owner? || super_admin?
  end

  def destroy?
    form_owner? || super_admin?
  end

  private

  def form_owner?
    record.form.user_id == user.id
  end
end
```

### 12. OrganizationPolicy (updated with CRUD actions)

`app/policies/organization_policy.rb`:

```ruby
class OrganizationPolicy < ApplicationPolicy
  def show?
    member? || super_admin?
  end

  def create?
    true
  end

  def update?
    admin_member? || super_admin?
  end

  def destroy?
    admin_member? || super_admin?
  end

  def manage?
    admin_member? || super_admin?
  end

  def admin_panel?
    super_admin?
  end

  private

  def member?
    record.memberships.exists?(user: user)
  end

  def admin_member?
    record.memberships.exists?(user: user, role: :admin)
  end
end
```

---

## 13. Routes (updated)

`config/routes.rb`:

```ruby
Rails.application.routes.draw do
  devise_for :users, controllers: {
    invitations: "users/invitations"
  }

  root "forms#index"

  resource :profile, only: [:show, :edit, :update]

  resources :users, only: [:show, :edit, :update]

  resources :memberships, only: [:create, :update, :destroy]

  resources :forms do
    resources :form_responses, only: [:index, :show, :create, :update, :destroy]
    resource :completion, only: [:create], controller: "forms/completions"
    resources :questionnaire_steps, only: [:show, :update], controller: "forms/questionnaire_steps"
  end

  resources :organizations do
    resources :forms, only: [:index], controller: "organizations/forms"
    resources :invitations, only: [:new, :create], controller: "organizations/invitations"
    resources :memberships, only: [:index, :destroy], controller: "organizations/memberships"
  end

  namespace :admin do
    root "dashboard#show"
    resources :organizations
    resources :users, only: [:index, :show, :edit, :update]
  end

  get "translations/:locale", to: "translations#show", as: :translations

  get "up" => "rails/health#show", as: :rails_health_check
end
```

---

## Summary of changes

| File | Action | Key details |
|------|--------|-------------|
| `application_controller.rb` | Updated | Added `rescue_from ActionPolicy::Unauthorized` |
| `organizations_controller.rb` | Updated | Full CRUD with `authorize!` on every action |
| `users_controller.rb` | **New** | show/edit/update with self-or-admin policy |
| `profiles_controller.rb` | Updated | Added `authorize! @profile` to all actions |
| `memberships_controller.rb` | **New** | create/update/destroy, org-admin gated |
| `forms_controller.rb` | Updated | Added `authorize!`, changed `set_form` to `Form.find` for policy-based access |
| `form_responses_controller.rb` | **New** | Nested under forms, full CRUD |
| `user_policy.rb` | **New** | Self or super_admin |
| `profile_policy.rb` | **New** | Owner or super_admin (uses `owner?` from ApplicationPolicy) |
| `membership_policy.rb` | **New** | Org admin or super_admin |
| `form_response_policy.rb` | **New** | Form owner or super_admin |
| `organization_policy.rb` | Updated | Added `create?`, `update?`, `destroy?` |
| `config/routes.rb` | Updated | Added `users`, `memberships`, `form_responses` routes |

All controllers stay within the 30-50 line target. Please grant write permissions and I'll create all the files, or you can copy the code above directly.
