I keep getting permission blocks for new file writes. Could you please approve the write permissions so I can create the service object files? I need to write to `app/services/` subdirectories.

In the meantime, let me show you the full set of service objects I'll create:

**Already exist (no changes needed):**
1. `QuestionnaireConfig` — singleton YAML config loader
2. `Scoring::Calculator` — core scoring at 3 levels

**New service objects to create (11 files):**

| # | File | Pattern | Purpose |
|---|------|---------|---------|
| 1 | `app/services/questionnaire/response_saver.rb` | B (save) | Persists form responses for a dimension step in a transaction |
| 2 | `app/services/questionnaire/completion_service.rb` | B (save) | Validates all dimensions answered, transitions AASM to completed |
| 3 | `app/services/questionnaire/progress_calculator.rb` | A (call) | Returns completion %, per-dimension breakdown |
| 4 | `app/services/questionnaire/extension_loader.rb` | A (call) | Merges core + territory extension indicators for a form |
| 5 | `app/services/scoring/extension_calculator.rb` | A (call) | Calculates scores for territory extension indicators |
| 6 | `app/services/charts/radar_data_builder.rb` | A (call) | Builds Chart.js-ready data structure for radar chart |
| 7 | `app/services/pdf/report_generator.rb` | A (call) | Generates PDF via Ferrum headless Chrome, attaches to form |
| 8 | `app/jobs/generate_pdf_job.rb` | Job | Async wrapper delegating to Pdf::ReportGenerator |
| 9 | `app/services/admin/dashboard_stats_service.rb` | A (call) | Dashboard statistics with optional filters |
| 10 | `app/services/organizations/member_inviter.rb` | B (save) | Invites or adds member to organization |
| 11 | `app/services/sync/form_reconciler.rb` | B (save) | Reconciles offline form data with server |

Please approve the file writes and I'll create all 11 files.
