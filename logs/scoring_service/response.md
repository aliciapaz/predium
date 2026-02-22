The `Scoring::Calculator` already exists and matches the requirements exactly. It:

- Takes a `form` in `initialize` (line 7-9)
- Has a `call` method returning `{ indicator_scores:, l2_scores:, l1_scores: }` (lines 11-23)
- Filters out extensions via `form.form_responses.core` (line 12)
- Handles missing responses by using `filter_map` to skip `nil` values (lines 37, 45)
- Uses `QuestionnaireConfig.l1_categories` and `QuestionnaireConfig.dimensions` to traverse the hierarchy
- Is 50 lines total, with methods of 5-7 lines each
- Follows the `call` method pattern per Telos conventions

The service is already implemented and looks correct. Is there something you'd like changed or extended?
