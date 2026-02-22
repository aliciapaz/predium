# Predium

An agroecological diagnostic platform that enables field technicians to assess farm sustainability through a structured questionnaire covering soil, water, biodiversity, management, socioeconomic, and resilience dimensions. The app is offline-first, territory-agnostic with extension support, multi-language (English and Spanish), and generates PDF reports with radar chart visualizations.

## Models

### Organization

- name:string
- has_many :memberships
- validates :name, presence: true, uniqueness: true

### User

- email:string
- encrypted_password:string
- first_name:string
- last_name:string
- locale:string
- platform_role:integer
- has_one :profile
- has_many :forms
- has_many :memberships
- validates :first_name, presence: true
- validates :last_name, presence: true

### Profile

- phone:string
- role_name:string
- country:string
- region:string
- locality:string
- belongs_to :user
- validates :user_id, uniqueness: true

### Membership

- role:integer
- belongs_to :user
- belongs_to :organization
- validates :user_id, uniqueness: { scope: :organization_id }

### Form

- name:string
- national_id:string
- gender:integer
- territory_key:string
- state:string
- latitude:float
- longitude:float
- system_types:text
- land_area:float
- country:string
- region:string
- locality:string
- observations:text
- work_force:integer
- date_of_birth:date
- phone:string
- completed_at:datetime
- synchronized_at:datetime
- discarded_at:datetime
- belongs_to :user
- has_many :form_responses
- validates :name, presence: true

### FormResponse

- indicator_key:string
- value:integer
- is_extension:boolean
- belongs_to :form
- validates :indicator_key, presence: true, uniqueness: { scope: :form_id }
- validates :value, presence: true, numericality: { in: 1..10, only_integer: true }

## Features

### YAML-Driven Questionnaire Configuration

QuestionnaireConfig is a singleton service object that loads and caches the questionnaire structure from config/questionnaire/core.yml. It uses a class-level Mutex for thread-safe lazy loading. The YAML file defines a hierarchical structure with 6 L1 categories (Soil, Water, Biodiversity, Management, Socioeconomic, Resilience), each containing L2 dimensions, each containing L2 indicator definitions with key, i18n_key, level, and position fields. The service provides class methods: core_indicators (returns all 74 core indicators), dimensions (returns all 15 dimensions), l1_categories (returns the 6 top-level categories), indicator(key) for single-indicator lookup, extension(territory_key) to load territory-specific extension indicators from config/questionnaire/extensions/{territory_key}.yml, and reload! to clear the thread-safe cache. The config is accessed throughout the app to drive the questionnaire flow, scoring calculations, and chart rendering.

### Questionnaire Step-by-Step Flow

The questionnaire presents indicators dimension by dimension. Each dimension is a step in the flow. Within each step, indicators are displayed with a 1-10 scoring grid using styled buttons. Selecting a score highlights the button with color coding (1-3 rose/red for low, 4-7 amber/mustard for medium, 8-10 green/forest for high) and shows a tier-appropriate description (low, medium, or high). After selecting a score, the UI auto-scrolls to the next question. A progress bar at the top shows completion percentage based on answered indicators vs total. Forms use AASM state machine with draft and completed states. The save-and-continue pattern persists form_responses as the user progresses through dimensions. Navigation allows moving between dimensions freely. When all dimensions are complete, the user can mark the form as completed which transitions its AASM state from draft to completed and sets completed_at.

### Scoring Calculation

Scoring::Calculator is a service object that takes a form and computes nested scores at three levels. It reads the form's form_responses and the QuestionnaireConfig structure. For each L2 indicator, it looks up the form_response value (1-10). For each dimension (L2 level), it computes the average of its indicator scores. For each L1 category, it computes the average of its dimension scores. The service filters out extension indicators (is_extension: true) from core scoring unless explicitly included. It returns a hash with indicator_scores (individual values keyed by indicator_key), l2_scores (dimension averages keyed by dimension key), and l1_scores (category averages keyed by category key). This data feeds into both the radar chart and the PDF report.

### Radar Chart Visualization

A radar chart displays the L1 category scores using Chart.js loaded from vendor/javascript/chart.umd.js (self-hosted, no CDN). A Stimulus controller (radar_chart_controller) initializes a Chart.js radar chart on connect. It reads score data from data attributes on the canvas element. The radar chart uses a 0-10 scale with category names as labels around the perimeter. The chart is styled with a semi-transparent fill area and colored border. The chart is rendered on the form show page when the form has responses. The Chart.js library must be self-hosted at vendor/javascript/chart.umd.js and imported via importmap, not loaded from a CDN, to support offline usage.

### Ferrum PDF Generation

PDF reports are generated using the Ferrum gem for headless Chrome HTML-to-PDF rendering. A dedicated HTML template renders the form data, scores, and radar chart into a print-friendly layout. A background job (GeneratePdfJob) processes PDF generation asynchronously. The generated PDF is attached to the form via Active Storage (has_one_attached :pdf). The PDF includes form metadata (name, location, date, territory), a radar chart image, dimension scores table, and individual indicator scores. The HTML template uses inline CSS for print styling. Ferrum is configured to wait for Chart.js to render before capturing the PDF.

### Territory Extensions

Territory-specific indicator extensions are loaded from YAML files at config/questionnaire/extensions/{territory_key}.yml. When a form has a territory_key set (e.g., "chile"), the QuestionnaireConfig.extension(territory_key) method loads additional indicators specific to that territory. Extension indicators are stored as FormResponse records with is_extension: true. The questionnaire flow appends extension dimensions after the core dimensions when a territory_key is present. Extension scores are calculated separately and can be included in or excluded from the main radar chart. The chile.yml extension file serves as the reference implementation for territory extensions.

### Offline-First Architecture

The app works offline using a Service Worker for asset caching and IndexedDB (via Dexie.js) for data storage. The Service Worker intercepts fetch requests and serves cached assets when offline. A TranslationsController serves locale JSON at /translations/{locale}.json for offline i18n. IndexedDB stores form data and form_responses locally. When connectivity is restored, a background sync mechanism pushes local changes to the server. A Stimulus controller monitors online/offline status and shows sync indicators. The app shell (navigation, layouts, static assets) is cached on first visit for instant offline loading.

### User Authentication

User authentication uses Devise with confirmable (email verification) and invitable (admin can invite users via email). Users register with email, password, first_name, and last_name. Email confirmation is required before sign-in. Admins can invite new users who receive an email with a link to set their password. The User model has platform_role as an integer enum with regular (0) and super_admin (1) values. Devise views are customized to match the app design with Tailwind CSS styling.

### Organization Management

Organizations are managed through a membership-based multi-tenancy model. Users belong to organizations through Membership records. Membership has a role integer enum with member (0) and admin (1) values. Organization admins can manage members (invite, remove, change roles). Users can belong to multiple organizations. The organizations index shows all organizations the current user belongs to. Organization show page lists members and their roles.

### Admin Dashboard

Super admin users (platform_role: super_admin) access an admin dashboard showing platform-wide statistics: total users, total forms, completed forms, forms by territory, and forms by state. The dashboard provides user management (list, view, invite) and organization management (list, view, create). Admin routes are namespaced under /admin. Access is restricted via ActionPolicy authorization checking platform_role == super_admin.

### I18n and Locale Management

The app supports English (en) and Spanish (es) locales. Locale files are organized at config/locales/en.yml, config/locales/es.yml, config/locales/en/questionnaire.yml, and config/locales/es/questionnaire.yml. Users can set their preferred locale in their profile. The app detects the preferred locale from the user's profile setting, falling back to the Accept-Language header, falling back to the default locale (en). Locale is set via an around_action in ApplicationController using I18n.with_locale. Questionnaire translations include names, descriptions, and scoring tier descriptions (low, medium, high) for all 74 indicators across both languages. A locale switcher in the navigation allows changing language on the fly.

### Geolocation

A Stimulus controller (geolocation_controller) uses the browser Geolocation API to capture GPS coordinates. When the user clicks a locate button, the controller calls navigator.geolocation.getCurrentPosition and populates hidden latitude and longitude form fields. Error handling covers permission denied, position unavailable, and timeout scenarios with user-friendly messages. The geolocation feature is used on the form edit page to capture the farm location.

## Constraints

- Authentication: Devise with confirmable and invitable modules
- Authorization: ActionPolicy for role-based access control
- Frontend: Hotwire (Turbo + Stimulus) with Tailwind CSS
- Testing: RSpec with FactoryBot and shoulda-matchers
- Database: PostgreSQL
- Rails: 8.1.2 with Propshaft asset pipeline and Importmap for JavaScript
- State Machine: AASM gem for form state transitions (draft to completed)
- Soft Delete: Discard gem for form soft deletion via discarded_at column
- PDF Generation: Ferrum gem for headless Chrome HTML-to-PDF rendering
- Charts: Chart.js self-hosted at vendor/javascript/chart.umd.js via importmap
- Offline: Service Worker with IndexedDB via Dexie.js for offline-first support
- I18n: English (en) and Spanish (es) with per-user locale preference
- Background Jobs: Solid Queue for async PDF generation
- Caching: Solid Cache for application caching
- WebSocket: Solid Cable for Action Cable
