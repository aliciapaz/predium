import { Controller } from "@hotwired/stimulus"
import { getForm, getResponses } from "lib/db"
import { cachedConfig, principles, dimensionIndicators, visibleDimensions } from "lib/config_cache"
import { load as loadTranslations, t } from "lib/i18n"
import { calculateScores } from "lib/scoring"
import { hydrateForm } from "lib/sync"
import { averageBand, badge, band, escape, icon } from "lib/ui"

// Hydrates the results shell from IndexedDB (KTD-4 amended): scores and
// charts always compute client-side via lib/scoring.js, online and offline.
export default class extends Controller {
  static targets = ["missing", "farmInfo", "radar", "dimensions", "indicators"]
  static values = { clientId: String }

  async connect() {
    this.config = await cachedConfig()
    await loadTranslations()
    this.form = await getForm(this.clientIdValue)

    // getForm is a bare cache read; unlike cachedConfig it does not self-heal.
    // A form completed on another device (or after a cache purge) lives in the
    // DB but is not in IndexedDB here, and Turbo navigation never fires the
    // window-load seed. Fetch just this form before giving up.
    if (!this.form && navigator.onLine) {
      await hydrateForm(this.clientIdValue)
      this.form = await getForm(this.clientIdValue)
    }

    if (!this.config || !this.form) {
      this.missingTarget.classList.remove("hidden")
      this.farmInfoTarget.innerHTML = ""
      return
    }

    const responses = await getResponses(this.clientIdValue)
    this.scores = calculateScores(this.config, responses, this.form.territory_key)

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
    const completed = form.state === "completed"

    const facts = []
    if (form.land_area) facts.push(this.fact(t("results.land_area"), `${form.land_area} ha`))
    if (form.work_force) facts.push(this.fact(t("results.workforce"), `${form.work_force} ${t("results.people")}`))
    if ((form.system_types || []).length) {
      facts.push(this.fact(t("results.system_types"), form.system_types.map((s) => t(`farm_info.system_${s}`)).join(", "), true))
    }

    this.farmInfoTarget.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="page-title min-w-0 break-words">${escape(form.name)}</h1>
        ${badge(t(completed ? "states.completed" : "states.draft"), completed ? "success" : "warning")}
      </div>
      <p class="mt-1 text-muted">${escape([location, completedOn].filter(Boolean).join(", "))}</p>
      ${facts.length ? `<dl class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">${facts.join("")}</dl>` : ""}`
  }

  fact(label, value, wide = false) {
    return `<div class="${wide ? "col-span-2 " : ""}rounded-lg bg-canvas px-4 py-3">
              <dt class="text-sm text-muted">${escape(label)}</dt>
              <dd class="mt-0.5 font-display text-lg font-bold text-ink">${escape(value)}</dd>
            </div>`
  }

  renderRadar() {
    const items = principles(this.config)
    const labels = items.map((principle) => t(`${principle.i18n_key}.name`))
    const scores = items.map((principle) => this.scores.l1Scores[principle.key] || 0)

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

    const list = document.createElement("ul")
    list.className = "mt-4 divide-y divide-line-soft border-t border-line-soft"
    list.innerHTML = items.map((principle, index) => {
      const score = scores[index]
      return `<li class="flex items-center justify-between gap-4 py-2.5">
                <span class="text-ink-soft">${escape(labels[index])}</span>
                <span class="score-chip"${score ? ` data-band="${band(Math.round(score))}"` : ""}>${score ? Number(score.toFixed(1)) : "-"}</span>
              </li>`
    }).join("")
    this.radarTarget.replaceChildren(mount, list)
  }

  renderDimensions() {
    this.dimensionsTarget.innerHTML = visibleDimensions(this.config, this.form.territory_key).map((dimension) => {
      const score = this.scores.l2Scores[dimension.key] || 0
      const level = averageBand(score)
      return `<div class="px-5 py-3.5">
                <div class="flex items-baseline justify-between gap-3 mb-2">
                  <span class="text-ink-soft">${escape(t(dimension.i18n_key))}</span>
                  <span class="font-display font-bold text-ink tabular-nums" data-score>${score > 0 ? score.toFixed(1) : "-"}</span>
                </div>
                <div class="meter h-2.5"><div class="score-bar"${level ? ` data-band="${level}"` : ""} style="width: ${score * 10}%"></div></div>
              </div>`
    }).join("")
  }

  renderIndicators() {
    this.indicatorsTarget.innerHTML = visibleDimensions(this.config, this.form.territory_key).map((dimension) => {
      const rows = dimensionIndicators(this.config, dimension.key, this.form.territory_key).map((indicator) => {
        const value = this.scores.indicatorScores[indicator.key]
        const chip = value != null
          ? `<span class="score-chip" data-band="${band(value)}">${value}</span>`
          : '<span class="score-chip">-</span>'
        const source = indicator.extension && indicator.extension !== this.form.territory_key
          ? badge(t(this.config.extensions[indicator.extension].i18n_key), "neutral")
          : ""
        return `<div class="flex items-center gap-4 px-5 py-3">
                  <span class="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">${escape(t(`${indicator.i18n_key}.name`))}${source}</span>
                  ${chip}
                </div>`
      }).join("")

      return `<details class="disclosure">
                <summary>
                  <span class="font-semibold text-ink">${escape(t(dimension.i18n_key))}</span>
                  ${icon("chevron_down", "disclosure-chevron")}
                </summary>
                <div class="divide-y divide-line-soft">${rows}</div>
              </details>`
    }).join("")
  }
}
