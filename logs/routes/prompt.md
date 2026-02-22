Generate config/routes.rb with RESTful resources for: Organization, User, Profile, Membership, Form, FormResponse.\n\nUse standard Rails resource routing conventions.\n\nFollow Telos code quality thresholds:
- Target 5-7 lines per method (hard limit: 10)
- Cyclomatic complexity max 7, perceived complexity max 8
- ABC size max 17
- Max 100 lines per class
- Favor many small methods over few large ones
- Method names should describe what they return or do
- One level of abstraction per method