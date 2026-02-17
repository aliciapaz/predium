# Testing Plan

> Predium v2 — Testing strategy, tools, and key scenarios.

---

## Stack

| Tool | Purpose |
|------|---------|
| RSpec | Test framework |
| FactoryBot | Test data generation |
| Shoulda Matchers | One-liner model validation/association tests |
| pdf-reader | Assert PDF content in service specs |
| DatabaseCleaner | Transaction-based cleanup between tests |
| SimpleCov | Code coverage reporting |

**Not used:**
- VCR/WebMock — no external API calls in v2.0
- Capybara/Cuprite — system-level browser testing deferred to Shortest
- Faker — prefer explicit test values for readability

---

## Test Types and Priorities

### 1. Request Specs (Primary)

The main test type. Every controller action gets a request spec.

**Directory:** `spec/requests/`

**Coverage targets:**
- All CRUD actions for every resource
- Authentication enforcement (redirects when unauthenticated)
- Authorization enforcement (403/redirect when unauthorized)
- Happy path responses (status codes, rendered content)
- Error paths (invalid params, missing records)
- Turbo Stream responses where applicable

**Key specs:**

```
spec/requests/
  forms_spec.rb                    # CRUD, state transitions, soft delete
  form_responses_spec.rb           # Create/update indicator scores
  form_comparisons_spec.rb         # Multi-form comparison view
  profiles_spec.rb                 # Create/update profile
  sessions_spec.rb                 # Login, logout
  registrations_spec.rb            # Sign up, confirmation
  passwords_spec.rb                # Reset flow
  invitations_spec.rb              # Invite, accept
  translations_spec.rb             # Locale JSON endpoint
  sync_spec.rb                     # Offline sync endpoint (receives client payloads)
  admin/
    users_spec.rb                  # Super admin user management
    organizations_spec.rb          # Super admin org management
    dashboard_spec.rb              # Aggregated data views
  organizations/
    memberships_spec.rb            # Org admin member management
```

**Example pattern:**

```ruby
RSpec.describe "Forms", type: :request do
  let(:user) { create(:user) }

  before { sign_in user }

  describe "POST /forms" do
    context "with valid params" do
      it "creates a draft form" do
        expect {
          post forms_path, params: { form: { name: "Test Farm" } }
        }.to change(Form, :count).by(1)

        expect(response).to redirect_to(form_path(Form.last))
        expect(Form.last.state).to eq("draft")
      end
    end

    context "with invalid params" do
      it "renders errors" do
        post forms_path, params: { form: { name: "" } }
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
```

---

### 2. Model Specs

Focus on validations, associations, enums, state machines, and scopes.

**Directory:** `spec/models/`

**Key specs:**

```
spec/models/
  user_spec.rb                     # Devise validations, platform_role enum, associations
  organization_spec.rb             # Validations, associations
  membership_spec.rb               # Uniqueness, role enum, associations
  profile_spec.rb                  # Associations, optional fields
  form_spec.rb                     # Validations, AASM states, scopes, soft delete
  form_response_spec.rb            # Validations (value 1-10), uniqueness, associations
```

**What to test per model:**
- `it { is_expected.to validate_presence_of(...) }`
- `it { is_expected.to belong_to(...) }` / `have_many` / `have_one`
- Enum values and their integer mappings
- AASM state transitions (Form: `draft` → `completed`)
- Scopes (e.g., `Form.kept`, `Form.completed`, `FormResponse.core`, `FormResponse.extensions`)
- Callbacks that set defaults

---

### 3. Service Specs

Business logic lives in services — these get thorough unit testing.

**Directory:** `spec/services/`

**Key specs:**

```
spec/services/
  questionnaire_config_spec.rb     # YAML loading, caching, indicator lookup
  forms/
    completer_spec.rb              # State transition, validation of all responses present
  pdf_generators/
    diagnosis_report_spec.rb       # PDF content and structure
  scoring/
    calculator_spec.rb             # L1/L2 score aggregation from responses
    extension_calculator_spec.rb   # Territory extension scoring, isolated from core
  sync/
    processor_spec.rb              # Server-side processing of offline sync payloads
```

**QuestionnaireConfig spec:**
- Loads core indicators from YAML
- Returns correct count of L1 (6) and L2 (74) indicators
- Loads territory extensions by key
- Returns `nil` / raises for unknown territory keys
- Caching: subsequent calls return same object
- Each indicator has required keys: `key`, `dimension`, `level`, `position`, `i18n_key`

**PDF generator spec:**
- Generates a valid PDF (non-zero byte string)
- PDF contains farm name, date, location
- PDF contains score values
- Uses pdf-reader to assert text content:

```ruby
RSpec.describe PdfGenerators::DiagnosisReport do
  let(:form) { create(:form, :completed_with_responses) }

  it "generates a PDF with farm info" do
    pdf_data = described_class.new(form).call
    reader = PDF::Reader.new(StringIO.new(pdf_data))
    text = reader.pages.map(&:text).join

    expect(text).to include(form.name)
    expect(text).to include(form.country)
  end
end
```

**Scoring calculator spec:**
- Calculates L2 dimension averages from individual responses
- Calculates L1 category averages from L2 scores
- Handles missing responses (incomplete drafts)
- Excludes extension indicators from core calculations

---

### 4. System Specs (Smoke Tests Only)

Minimal system specs to verify the app boots and key pages render. Full browser-based feature testing is deferred to Shortest.

**Directory:** `spec/system/`

**Scope — only these scenarios:**

```
spec/system/
  smoke_spec.rb
```

```ruby
RSpec.describe "Smoke tests", type: :system do
  it "loads the login page" do
    visit new_user_session_path
    expect(page).to have_content(I18n.t("devise.sessions.new.sign_in"))
  end

  it "redirects unauthenticated users to login" do
    visit forms_path
    expect(page).to have_current_path(new_user_session_path)
  end

  it "loads the dashboard after login" do
    user = create(:user)
    sign_in user
    visit root_path
    expect(page).to have_http_status(200)
  end
end
```

**Not in scope for system specs:**
- Form creation/editing workflows
- Questionnaire filling flow
- Offline behavior
- Chart rendering
- PDF download

These are covered by request specs (server behavior) and will be covered by Shortest (full E2E).

---

## Factories

**Directory:** `spec/factories/`

```
spec/factories/
  users.rb
  organizations.rb
  memberships.rb
  profiles.rb
  forms.rb
  form_responses.rb
```

**Key factory traits:**

```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    email { "user#{SecureRandom.hex(4)}@example.com" }
    password { "password123" }
    first_name { "Test" }
    last_name { "User" }
    confirmed_at { Time.current }

    trait :super_admin do
      platform_role { :super_admin }
    end
  end
end

# spec/factories/forms.rb
FactoryBot.define do
  factory :form do
    user
    name { "Test Farm" }
    country { "CL" }

    trait :completed do
      state { "completed" }
      completed_at { Time.current }
    end

    trait :completed_with_responses do
      completed
      after(:create) do |form|
        QuestionnaireConfig.core_indicators.each do |indicator|
          create(:form_response, form: form, indicator_key: indicator[:key], value: rand(1..10))
        end
      end
    end

    trait :discarded do
      discarded_at { Time.current }
    end
  end
end

# spec/factories/form_responses.rb
FactoryBot.define do
  factory :form_response do
    form
    indicator_key { "soil_coverage" }
    value { 5 }
    is_extension { false }
  end
end
```

---

## Running Tests

```bash
# Full suite
bundle exec rspec

# Specific directory
bundle exec rspec spec/requests
bundle exec rspec spec/models
bundle exec rspec spec/services

# Specific file
bundle exec rspec spec/requests/forms_spec.rb

# With coverage report
COVERAGE=true bundle exec rspec
```

---

## CI Integration

Tests run in GitHub Actions on every push and PR (see `docs/deployment.md`).

**CI spec configuration:**
- PostgreSQL service container for database
- `RAILS_ENV=test`
- `bundle exec rspec` with `--format documentation --format RspecJunitFormatter --out tmp/rspec_results.xml`
- SimpleCov report uploaded as artifact
- Fail build on any test failure

---

## Coverage Goals

| Area | Target |
|------|--------|
| Models | 100% of validations, associations, enums, state machines |
| Services | 100% of public methods |
| Request specs | Every controller action (happy path + key error paths) |
| System specs | Smoke tests only (3-5 scenarios) |
| Overall | 90%+ line coverage |

---

## Deferred Testing

| What | When | Tool |
|------|------|------|
| Full E2E browser flows | QA phase | Shortest (antiwork) |
| Offline/sync behavior | QA phase | Manual testing + Shortest |
| Chart visual correctness | QA phase | Visual regression with Shortest |
| Performance/load testing | Pre-production | k6 or similar |
| Accessibility testing | QA phase | axe-core integration |
