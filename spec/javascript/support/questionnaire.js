import { putConfig, putLocale } from "lib/db"

// Mirrors /api/questionnaire: principles are answered directly, indicators live
// only in territory extensions, and each extension's chain is already flattened
// with every indicator tagged by its source territory. coast extends andes.
const andesIndicators = [
  { key: "compaction", i18n_key: "indicators.compaction", dimension: "structure", extension: "andes" },
  { key: "erosion", i18n_key: "indicators.erosion", dimension: "structure", extension: "andes" },
  { key: "organic_matter", i18n_key: "indicators.organic_matter", dimension: "fertility", extension: "andes" },
  { key: "irrigation", i18n_key: "indicators.irrigation", dimension: "supply", extension: "andes" }
]

export const config = {
  fingerprint: "test-fingerprint",
  principles: [
    { key: "diversity", i18n_key: "principles.diversity" },
    { key: "recycling", i18n_key: "principles.recycling" }
  ],
  categories: [
    { key: "soil", i18n_key: "categories.soil" },
    { key: "water", i18n_key: "categories.water" }
  ],
  dimensions: [
    { key: "structure", i18n_key: "dimensions.structure", category: "soil" },
    { key: "fertility", i18n_key: "dimensions.fertility", category: "soil" },
    { key: "supply", i18n_key: "dimensions.supply", category: "water" }
  ],
  extensions: {
    andes: { territory: "andes", i18n_key: "extensions.andes", extends: null, indicators: andesIndicators },
    coast: {
      territory: "coast",
      i18n_key: "extensions.coast",
      extends: "andes",
      indicators: [
        ...andesIndicators,
        { key: "salinity", i18n_key: "indicators.salinity", dimension: "supply", extension: "coast" }
      ]
    },
    puna: {
      territory: "puna",
      i18n_key: "extensions.puna",
      extends: null,
      indicators: [{ key: "frost", i18n_key: "indicators.frost", dimension: "structure", extension: "puna" }]
    }
  }
}

export const translations = {
  "categories.soil": "Soil",
  "categories.water": "Water",
  "dimensions.structure": "Structure",
  "dimensions.fertility": "Fertility",
  "dimensions.supply": "Supply",
  "extensions.andes": "Andes extension",
  "extensions.coast": "Coast extension",
  "extensions.puna": "Puna extension",
  "principles.diversity.name": "Diversity",
  "principles.recycling.name": "Recycling",
  "questionnaire.principles_title": "Principles",
  "questionnaire.no_territory_hint": "Choose a territory to see its indicators",
  "indicators.compaction.name": "Compaction",
  "indicators.compaction.scoring.low": "Hard to push a rod in",
  "indicators.compaction.scoring.medium": "A rod goes in with effort",
  "indicators.compaction.scoring.high": "Spongy soil",
  "indicators.erosion.name": "Erosion",
  "indicators.organic_matter.name": "Organic matter",
  "indicators.irrigation.name": "Irrigation",
  "indicators.frost.name": "Frost",
  "indicators.salinity.name": "Salinity",
  "questionnaire.indicators_count": "%{answered} of %{total} indicators",
  "questionnaire.section_of": "Section %{current} of %{total}",
  "questionnaire.new_questionnaire": "New questionnaire",
  "titles.form_edit": "Edit form",
  "questionnaire.answered_count": "%{answered}/%{total} answered",
  "questionnaire.continue": "Continue",
  "questionnaire.next_up": "Next: %{section}",
  "questionnaire.indicator_help": "What this indicator measures",
  "questionnaire.score_legend": "Score from 1 to 10",
  "questionnaire.missing_count.one": "1 indicator left",
  "questionnaire.missing_count.other": "%{count} indicators left",
  "farm_info.fields_filled": "%{filled} of %{total}",
  "farm_info.use_gps": "Use GPS",
  "farm_info.locating": "Locating…",
  "farm_info.gps_unsupported": "This device cannot read its location.",
  "farm_info.gps_failed": "We could not read your location.",
  "offline.saved_locally": "Saved on this device",
  "offline.config_unavailable": "Questionnaire not available offline",
  "offline.complete_missing_indicators": "Score every indicator to complete",
  "offline.complete_requires_sync": "Connect to complete",
  "offline.extension_badge": "Territory",
  "offline.online": "Online",
  "offline.offline": "Offline",
  "offline.pending_count.one": "1 pending",
  "offline.pending_count.other": "%{count} pending",
  "offline.pending_sync": "Pending sync",
  "offline.session_expired": "Session expired",
  "offline.last_sync": "Last sync",
  "states.draft": "Draft",
  "states.completed": "Completed",
  "forms.drafts": "Drafts",
  "forms.completed": "Completed forms",
  "forms.no_drafts": "No drafts yet",
  "forms.no_completed": "No completed forms yet",
  "forms.view_results": "View results",
  "results.completed_on": "Completed %{date}",
  "results.land_area": "Land area",
  "results.workforce": "Workforce",
  "results.people": "people",
  "results.system_types": "Systems",
  "farm_info.system_agriculture": "Agriculture",
  "farm_info.system_forestry": "Forestry"
}

export async function seedQuestionnaire() {
  await putConfig(config)
  await seedTranslations()
}

export async function seedTranslations() {
  await putLocale("en", translations, config.fingerprint)
}
