Generate RSpec tests for models: Organization, User, Profile, Membership, Form, FormResponse.\n\nGenerate request specs for controllers.\n\nGenerate FactoryBot factories.\n\nCover features: YAML-Driven Questionnaire Configuration, Questionnaire Step-by-Step Flow, Scoring Calculation, Radar Chart Visualization, Ferrum PDF Generation, Territory Extensions, Offline-First Architecture, User Authentication, Organization Management, Admin Dashboard, I18n and Locale Management, Geolocation.\n\nFollow Telos testing conventions:
- RSpec with FactoryBot
- Prefer request specs over system specs (faster, more reliable)
- Only use system specs when testing complex JS interactions
- Use let and before blocks, avoid fixtures
- Test critical paths and edge cases