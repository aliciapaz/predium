import { Controller } from "@hotwired/stimulus"
import { getForm, getResponses } from "lib/db"
import { cachedConfig, dimensionIndicators } from "lib/config_cache"
import { load as loadTranslations, t } from "lib/i18n"
import { calculateScores } from "lib/scoring"

// Hydrates the results shell from IndexedDB (KTD-4 amended): scores and
// charts always compute client-side via lib/scoring.js, online and offline.
export default class extends Controller {
  static targets = ["missing", "farmInfo", "radar", "dimensions", "indicators"]
  static values = { clientId: String }

  async connect() {
    await loadTranslations()
    this.config = await cachedConfig()
    this.form = await getForm(this.clientIdValue)

    if (!this.config || !this.form) {
      this.missingTarget.classList.remove("hidden")
      this.farmInfoTarget.innerHTML = ""
      return
    }

    const responses = await getResponses(this.clientIdValue)
    this.scores = calculateScores(this.config, responses)

    this.renderFarmInfo()
    this.renderRadar()
    this.renderDimensions()
    this.renderIndicators()
  }

  renderFarmInfo() {
    const form = this.form
    const location = [form.locality, form.region, form.country].filter(Boolean).join(", ")
    const completedOn = form.completed_at
      ? t("results.completed_on", { date: new Date(form.completed_at).toLocaleDateString(document.documentElement.lang) })
      : ""
    const stateLabel = form.state === "completed" ? t("states.completed") : t("states.draft")
    const stateClass = form.state === "completed" ? "bg-forest-100 text-forest-700" : "bg-mustard-100 text-mustard-700"

    const facts = []
    if (form.land_area) facts.push(this.fact(t("results.land_area"), `${form.land_area} ha`))
    if (form.work_force) facts.push(this.fact(t("results.workforce"), `${form.work_force} ${t("results.people")}`))
    if ((form.system_types || []).length) {
      facts.push(this.fact(t("results.system_types"), form.system_types.map((s) => t(`farm_info.system_${s}`)).join(", "), true))
    }

    this.farmInfoTarget.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-earth-900">${this.escape(form.name)}</h1>
          <p class="text-sm text-earth-500 mt-1">${this.escape(location)}${location && completedOn ? " &middot; " : ""}${this.escape(completedOn)}</p>
        </div>
        <span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${stateClass}">${this.escape(stateLabel)}</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">${facts.join("")}</div>`
  }

  fact(label, value, wide = false) {
    return `<div${wide ? ' class="col-span-2"' : ""}>
              <span class="text-earth-500">${this.escape(label)}</span>
              <p class="font-medium text-earth-800">${this.escape(value)}</p>
            </div>`
  }

  renderRadar() {
    const labels = this.config.categories.map((category) => t(category.i18n_key))
    const scores = this.config.categories.map((category) => this.scores.l1Scores[category.key] || 0)

    // Built via DOM APIs: the JSON attribute values contain double quotes,
    // which an innerHTML template would need attribute-escaping for.
    const mount = document.createElement("div")
    mount.className = "max-w-md mx-auto"
    mount.dataset.controller = "radar-chart"
    mount.setAttribute("data-radar-chart-labels-value", JSON.stringify(labels))
    mount.setAttribute("data-radar-chart-scores-value", JSON.stringify(scores))
    const canvas = document.createElement("canvas")
    canvas.setAttribute("data-radar-chart-target", "canvas")
    mount.appendChild(canvas)
    this.radarTarget.replaceChildren(mount)
  }

  renderDimensions() {
    this.dimensionsTarget.innerHTML = this.config.dimensions.map((dimension) => {
      const score = this.scores.l2Scores[dimension.key] || 0
      const color = score >= 7 ? "bg-forest-500" : score >= 4 ? "bg-mustard-500" : "bg-rose-500"
      return `<div class="flex items-center gap-4 px-5 py-3">
                <span class="text-sm text-earth-700 w-48 shrink-0">${this.escape(t(dimension.i18n_key))}</span>
                <div class="flex-1 bg-earth-100 rounded-full h-3">
                  <div class="${color} h-3 rounded-full transition-all" style="width: ${score * 10}%"></div>
                </div>
                <span class="text-sm font-semibold text-earth-800 w-10 text-right">${score > 0 ? score.toFixed(1) : "-"}</span>
              </div>`
    }).join("")
  }

  renderIndicators() {
    this.indicatorsTarget.innerHTML = this.config.dimensions.map((dimension) => {
      const rows = dimensionIndicators(this.config, dimension.key).map((indicator) => {
        const value = this.scores.indicatorScores[indicator.key]
        let badge = '<span class="text-earth-300">-</span>'
        if (value != null) {
          const cls = value >= 8 ? "bg-forest-100 text-forest-700" : value >= 4 ? "bg-mustard-100 text-mustard-700" : "bg-rose-100 text-rose-700"
          badge = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-semibold ${cls}">${value}</span>`
        }
        return `<div class="flex items-center gap-4 px-5 py-2.5 text-sm">
                  <span class="text-earth-600 flex-1">${this.escape(t(`${indicator.i18n_key}.name`))}</span>
                  ${badge}
                </div>`
      }).join("")

      return `<div class="bg-white border border-earth-200 rounded-lg" data-controller="collapsible">
                <button type="button" data-action="collapsible#toggle" class="flex items-center justify-between w-full px-5 py-3 text-left">
                  <span class="font-medium text-earth-800">${this.escape(t(dimension.i18n_key))}</span>
                  <svg data-collapsible-target="icon" class="w-5 h-5 text-earth-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                <div data-collapsible-target="content" class="hidden border-t border-earth-100">${rows}</div>
              </div>`
    }).join("")
  }

  escape(text) {
    const div = document.createElement("div")
    div.textContent = text ?? ""
    return div.innerHTML
  }
}
