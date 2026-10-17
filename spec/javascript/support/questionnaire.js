import { putConfig, putLocale } from "lib/db"

export const config = {
  fingerprint: "test-fingerprint",
  categories: [
    { key: "soil", i18n_key: "categories.soil" },
    { key: "water", i18n_key: "categories.water" }
  ],
  dimensions: [
    { key: "structure", i18n_key: "dimensions.structure", category: "soil" },
    { key: "fertility", i18n_key: "dimensions.fertility", category: "soil" },
    { key: "supply", i18n_key: "dimensions.supply", category: "water" }
  ],
  indicators: [
    { key: "compaction", i18n_key: "indicators.compaction", dimension: "structure" },
    { key: "erosion", i18n_key: "indicators.erosion", dimension: "structure" },
    { key: "organic_matter", i18n_key: "indicators.organic_matter", dimension: "fertility" },
    { key: "irrigation", i18n_key: "indicators.irrigation", dimension: "supply" }
  ],
  extensions: {
    andes: {
      territory: "andes",
      i18n_key: "extensions.andes",
      indicators: [{ key: "frost", i18n_key: "indicators.frost", dimension: "structure", extension: "andes" }]
    },
    coast: {
      territory: "coast",
      i18n_key: "extensions.coast",
      indicators: [{ key: "salinity", i18n_key: "indicators.salinity", dimension: "supply", extension: "coast" }]
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
  "indicators.compaction.name": "Compaction",
  "indicators.erosion.name": "Erosion",
  "indicators.organic_matter.name": "Organic matter",
  "indicators.irrigation.name": "Irrigation",
  "indicators.frost.name": "Frost",
  "indicators.salinity.name": "Salinity",
  "questionnaire.indicators_count": "%{answered} of %{total} indicators",
  "questionnaire.dimension_of": "Dimension %{current} of %{total}",
  "questionnaire.answered_count": "%{answered}/%{total} answered",
  "questionnaire.continue": "Continue",
  "offline.saved_locally": "Saved on this device",
  "offline.config_unavailable": "Questionnaire not available offline",
  "offline.complete_missing_indicators": "Score every indicator to complete",
  "offline.complete_requires_sync": "Connect to complete",
  "offline.extension_badge": "Territory",
  "offline.online": "Online",
  "offline.offline": "Offline",
  "offline.pending_count": "%{count} pending",
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

// lib/i18n caches the first map it loads for the module's lifetime, so every
// test in a file must seed the same translations.
export async function seedTranslations() {
  await putLocale("en", translations, config.fingerprint)
}
