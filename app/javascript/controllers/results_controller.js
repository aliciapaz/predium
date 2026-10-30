import { Controller } from "@hotwired/stimulus"
import { getForm, getResponses } from "lib/db"
import { cachedConfig, principles, dimensionIndicators, visibleDimensions } from "lib/config_cache"
import { load as loadTranslations, t, has } from "lib/i18n"
import { calculateScores } from "lib/scoring"
import { hydrateForm } from "lib/sync"
import { averageBand, badge, band, escape, icon } from "lib/ui"

// Hydrates the results shell from IndexedDB (KTD-4 amended), or from the form
// the server embedded when the viewer does not own it. Scores and charts
// always compute client-side via lib/scoring.js, online and offline.
export default class extends Controller {
  static targets = ["missing", "loadFailed", "farmInfo", "radar", "dimensions", "indicators", "continue"]
  static values = { clientId: String, form: Object }

  async connect() {
    this.config = await cachedConfig()
    await loadTranslations()
    this.form = this.hasFormValue ? this.formValue : await this.localForm()

    if (!this.config || !this.form) {
      const target = navigator.onLine ? this.loadFailedTarget : this.missingTarget
      target.classList.remove("hidden")
      this.farmInfoTarget.innerHTML = ""
      return
    }

    const responses = this.hasFormValue ? this.embeddedResponses() : await getResponses(this.clientIdValue)
    this.scores = calculateScores(this.config, responses, this.form.territory_key)

    this.renderFarmInfo()
    if (this.hasContinueTarget) this.continueTarget.hidden = this.form.state !== "draft"
    this.renderRadar()
    this.renderDimensions()
    this.renderIndicators()
  }

  // getForm is a bare cache read; unlike cachedConfig it does not self-heal.
  // A form completed on another device (or after a cache purge) lives in the
  // DB but is not in IndexedDB here, and Turbo navigation never fires the
  // window-load seed. Fetch just this form before giving up.
  async localForm() {
    const form = await getForm(this.clientIdValue)
    if (form || !navigator.onLine) return form

    await hydrateForm(this.clientIdValue)
    return getForm(this.clientIdValue)
  }

  embeddedResponses() {
    return Object.fromEntries((this.formValue.responses || []).map((response) => [response.indicator_key, response.value]))
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
      ${this.overallSummary()}
      ${facts.length ? `<dl class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">${facts.join("")}</dl>` : ""}`
  }

  // The headline is the mean of the scored dimensions, each weighted equally;
  // principles keep their own section and radar. Weighting is open in #43.
  overallSummary() {
    const scored = visibleDimensions(this.config, this.form.territory_key)
      .map((dimension) => ({ name: t(dimension.i18n_key), score: this.scores.l2Scores[dimension.key] }))
      .filter((item) => item.score > 0)
    if (!scored.length) return ""

    const overall = Math.round((scored.reduce((sum, item) => sum + item.score, 0) / scored.length) * 10) / 10
    const values = scored.map((item) => item.score)
    const namesAt = (score) => scored.filter((item) => item.score === score).map((item) => item.name).join(", ")
    const notes = [t(`results.overall_hint.${scored.length === 1 ? "one" : "other"}`, { count: scored.length })]
    if (Math.max(...values) > Math.min(...values)) {
      notes.push(t("results.highest", { name: namesAt(Math.max(...values)) }))
      notes.push(t("results.lowest", { name: namesAt(Math.min(...values)) }))
    }

    return `<div class="mt-5 flex items-center gap-4 rounded-lg bg-canvas px-4 py-3" data-overall>
              <span class="score-chip" data-band="${averageBand(overall)}">${overall.toFixed(1)}</span>
              <div class="min-w-0">
                <p class="font-semibold text-ink">${escape(t("results.overall_score"))}</p>
                <p class="text-sm text-muted">${escape(notes.join(" "))}</p>
              </div>
            </div>`
  }

  // Full principle names run to 70 characters; the chart and headline use the
  // short chart_label when the locale has one.
  chartLabel(principle) {
    const key = `${principle.i18n_key}.chart_label`
    return t(has(key) ? key : `${principle.i18n_key}.name`)
  }

  fact(label, value, wide = false) {
    return `<div class="${wide ? "col-span-2 " : ""}rounded-lg bg-canvas px-4 py-3">
              <dt class="text-sm text-muted">${escape(label)}</dt>
              <dd class="mt-0.5 font-display text-lg font-bold text-ink">${escape(value)}</dd>
            </div>`
  }

  renderRadar() {
    const items = principles(this.config)
    const names = items.map((principle) => t(`${principle.i18n_key}.name`))
    const labels = items.map((principle) => this.chartLabel(principle))
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
                <span class="text-ink-soft">${escape(names[index])}</span>
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
      const score = this.scores.l2Scores[dimension.key] || 0
      const level = averageBand(score)
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
                  <span class="flex-1 min-w-0 font-semibold text-ink">${escape(t(dimension.i18n_key))}</span>
                  <span class="score-chip"${level ? ` data-band="${level}"` : ""}>${score > 0 ? score.toFixed(1) : "-"}</span>
                  ${icon("chevron_down", "disclosure-chevron")}
                </summary>
                <div class="divide-y divide-line-soft">${rows}</div>
              </details>`
    }).join("")
  }
}
