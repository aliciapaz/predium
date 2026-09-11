import { Controller } from "@hotwired/stimulus"
import { newClientId, getForm, saveForm, getResponses, saveResponse, enqueue, pruneStaleExtensions } from "lib/db"
import { cachedConfig, dimensionIndicators, extensionIndicators } from "lib/config_cache"
import { load as loadTranslations, t } from "lib/i18n"
import { syncNow, hydrateForm, csrfToken } from "lib/sync"

const FARM_FIELDS = [
  "name", "national_id", "date_of_birth", "phone", "gender", "work_force",
  "land_area", "latitude", "longitude", "country", "region", "locality",
  "observations", "territory_key"
]

// Local-first editor (KTD-4): reads questionnaire config and saved values from
// IndexedDB and writes every change back to IndexedDB plus the sync queue.
// The server-rendered shell around this controller carries no form data.
export default class extends Controller {
  static targets = [
    "title", "saveState", "progressText", "progressBar", "dimensionNav",
    "indicators", "prevButton", "nextButton", "completeForm", "completeButton", "completeHint"
  ]
  static values = { clientId: String, formsUrl: String }

  async connect() {
    this.clientId = this.clientIdValue || newClientId()
    if (!this.clientIdValue) {
      history.replaceState(null, "", this.formPath("/edit"))
    }

    await loadTranslations()
    this.config = await cachedConfig()
    if (!this.config) {
      this.indicatorsTarget.innerHTML = `<p class="text-sm text-rose-600">${this.escape(t("offline.config_unavailable"))}</p>`
      return
    }

    this.form = (await getForm(this.clientId)) || { client_id: this.clientId, state: "draft", system_types: [] }
    if (this.form.state === "completed") {
      window.Turbo.visit(this.formPath())
      return
    }

    this.responses = await getResponses(this.clientId)
    this.currentIndex = 0

    this.hydrateFarmFields()
    if (this.form.name) this.titleTarget.textContent = this.form.name
    this.element.addEventListener("change", (event) => this.handleChange(event))
    this.element.addEventListener("input", (event) => this.handleInput(event))
    this.completeFormTarget.addEventListener("submit", (event) => this.handleComplete(event))

    this.render()
  }

  // formsUrl may carry a query string (e.g. ?locale=es), so path segments must
  // be inserted before it, never appended after.
  formPath(suffix = "") {
    const url = new URL(this.formsUrlValue, window.location.origin)
    return `${url.pathname.replace(/\/$/, "")}/${this.clientId}${suffix}${url.search}`
  }

  // ── Dimensions ─────────────────────────────────────────

  dimensions() {
    const core = this.config.dimensions.map((dimension) => ({ ...dimension, extension: false }))
    const territory = this.form.territory_key
    const extIndicators = extensionIndicators(this.config, territory)
    if (extIndicators.length) {
      core.push({
        key: `extension:${territory}`,
        i18n_key: this.config.extensions[territory].i18n_key,
        extension: true
      })
    }
    return core
  }

  indicatorsFor(dimension) {
    if (dimension.extension) return extensionIndicators(this.config, this.form.territory_key)
    return dimensionIndicators(this.config, dimension.key)
  }

  previousDimension() {
    if (this.currentIndex > 0) this.showDimension(this.currentIndex - 1)
  }

  nextDimension() {
    if (this.currentIndex < this.dimensions().length - 1) this.showDimension(this.currentIndex + 1)
  }

  showDimension(index) {
    this.currentIndex = index
    this.render()
    this.element.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ── Persistence ────────────────────────────────────────

  handleInput(event) {
    if (event.target.dataset.farmField) this.scheduleFarmSave()
  }

  handleChange(event) {
    const target = event.target
    if (target.dataset.farmField) {
      this.scheduleFarmSave(true)
    } else if (target.name && target.name.startsWith("form_responses[")) {
      const key = target.name.slice("form_responses[".length, -1)
      this.persistResponse(key, target.value)
    }
  }

  scheduleFarmSave(immediate = false) {
    clearTimeout(this.farmSaveTimer)
    this.farmSaveTimer = setTimeout(() => this.persistFarmInfo(), immediate ? 0 : 400)
  }

  async persistFarmInfo() {
    const territoryBefore = this.form.territory_key

    FARM_FIELDS.forEach((field) => {
      const input = this.element.querySelector(`[data-farm-field="${field}"]`)
      if (input) this.form[field] = input.value === "" ? null : input.value
    })
    this.form.system_types = Array.from(
      this.element.querySelectorAll('[data-farm-field="system_types"]:checked')
    ).map((box) => box.value)

    await saveForm(this.form)
    if (this.form.territory_key !== territoryBefore) await this.dropStaleExtensions()
    await enqueue(this.clientId)
    this.markSaved()
    if (this.form.name) this.titleTarget.textContent = this.form.name
    if (this.form.territory_key !== territoryBefore) this.render()
    this.refreshCompleteState()
    syncNow()
  }

  // A territory change hides the old extension questions; their saved answers
  // must also go, or every sync ships keys the new territory disallows.
  async dropStaleExtensions() {
    const allowed = extensionIndicators(this.config, this.form.territory_key).map((indicator) => indicator.key)
    await pruneStaleExtensions(this.clientId, allowed)
    const allowedSet = new Set(allowed)
    Object.keys(this.responses).forEach((key) => {
      const isExtension = !this.config.indicators.some((indicator) => indicator.key === key)
      if (isExtension && !allowedSet.has(key)) delete this.responses[key]
    })
  }

  async persistResponse(key, value) {
    if (!value) return
    const isExtension = !this.config.indicators.some((indicator) => indicator.key === key)
    this.responses[key] = Number(value)
    if (!(await getForm(this.clientId))) await saveForm(this.form)
    await saveResponse(this.clientId, key, value, isExtension)
    await enqueue(this.clientId)
    this.markSaved()
    this.updateProgress()
    this.renderNav()
    this.refreshCompleteState()
    syncNow()
  }

  markSaved() {
    this.saveStateTarget.textContent = t("offline.saved_locally")
  }

  // ── Completion ─────────────────────────────────────────

  async handleComplete(event) {
    event.preventDefault()
    this.completeButtonTarget.disabled = true
    await syncNow()
    const form = await getForm(this.clientId)
    if (navigator.onLine && form && !form.dirty) {
      // A static form action cannot carry the runtime client_id without
      // invalidating Rails' per-form CSRF token, so the POST goes through
      // fetch with the session token from the meta tag.
      const response = await fetch(this.formPath("/completion"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken(), Accept: "text/html" }
      })
      if (response.ok || response.redirected) {
        // /completion flips state to completed server-side only; refresh the
        // local copy so results render the completed form, not a stale draft.
        await hydrateForm(this.clientId)
        window.Turbo.visit(response.url, { action: "replace" })
        return
      }
    }
    this.showHint(t("offline.complete_requires_sync"))
    this.refreshCompleteState()
  }

  refreshCompleteState() {
    const allScored = this.config.indicators.every((indicator) => this.responses[indicator.key] !== undefined)
    const online = navigator.onLine
    this.completeButtonTarget.disabled = !(allScored && online)

    if (!allScored) this.showHint(t("offline.complete_missing_indicators"))
    else if (!online) this.showHint(t("offline.complete_requires_sync"))
    else this.completeHintTarget.classList.add("hidden")
  }

  showHint(text) {
    this.completeHintTarget.textContent = text
    this.completeHintTarget.classList.remove("hidden")
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    this.renderNav()
    this.renderIndicators()
    this.updateProgress()
    this.refreshCompleteState()
    const last = this.currentIndex === this.dimensions().length - 1
    this.prevButtonTarget.disabled = this.currentIndex === 0
    this.nextButtonTarget.classList.toggle("hidden", last)
  }

  renderNav() {
    this.dimensionNavTarget.innerHTML = this.dimensions().map((dimension, index) => {
      const indicators = this.indicatorsFor(dimension)
      const answered = indicators.filter((indicator) => this.responses[indicator.key] !== undefined).length
      const current = index === this.currentIndex
      const done = indicators.length > 0 && answered === indicators.length
      const partial = answered > 0 && !done

      let cls = "snap-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer "
      if (current) cls += "bg-forest-600 text-white"
      else if (done) cls += "bg-forest-50 text-forest-700 hover:bg-forest-100"
      else if (partial) cls += "bg-mustard-50 text-mustard-700 hover:bg-mustard-100"
      else cls += "bg-earth-100 text-earth-500 hover:bg-earth-200"
      if (dimension.extension) cls += " border border-dashed border-earth-400"

      return `<button type="button" class="${cls}" data-action="form-editor#jump" data-index="${index}">
                ${done ? this.checkIcon() : partial ? '<span class="w-2 h-2 rounded-full bg-current"></span>' : ""}
                ${this.escape(t(dimension.i18n_key))}
              </button>`
    }).join("")
  }

  jump(event) {
    this.showDimension(Number(event.currentTarget.dataset.index))
  }

  renderIndicators() {
    const dimension = this.dimensions()[this.currentIndex]
    const indicators = this.indicatorsFor(dimension)
    const answered = indicators.filter((indicator) => this.responses[indicator.key] !== undefined).length

    const header = `
      <h2 class="text-xl font-bold text-earth-900">${this.escape(t(dimension.i18n_key))}</h2>
      <p class="text-sm text-earth-500">
        ${this.escape(t("questionnaire.dimension_of", { current: this.currentIndex + 1, total: this.dimensions().length }))}
        &middot;
        ${this.escape(t("questionnaire.answered_count", { answered, total: indicators.length }))}
        ${dimension.extension ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-earth-100 text-earth-600">${this.escape(t("offline.extension_badge"))}</span>` : ""}
      </p>`

    this.indicatorsTarget.innerHTML = header + indicators.map((indicator) => this.indicatorCard(indicator)).join("")
  }

  indicatorCard(indicator) {
    const key = indicator.key
    const base = indicator.i18n_key
    const value = this.responses[key]

    const buttons = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
      let cls = "bg-earth-50 border-earth-300 text-earth-600 hover:bg-earth-100"
      if (value === n) {
        if (n <= 3) cls = "bg-rose-100 border-rose-500 text-rose-700 ring-2 ring-rose-300"
        else if (n <= 7) cls = "bg-mustard-100 border-mustard-500 text-mustard-700 ring-2 ring-mustard-300"
        else cls = "bg-forest-100 border-forest-500 text-forest-700 ring-2 ring-forest-300"
      }
      return `<button type="button" data-question-target="optionBtn" data-action="question#select" data-value="${n}"
                      class="aspect-square min-h-[44px] flex items-center justify-center border-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${cls}">${n}</button>`
    }).join("")

    const descClass = (matches) => {
      if (value === undefined) return ""
      return matches ? "" : "bg-earth-50 border-earth-100 text-earth-400"
    }

    return `
      <div class="bg-white border border-earth-200 rounded-lg p-5" data-controller="question">
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-base font-semibold text-earth-900">${this.escape(t(`${base}.name`))}</h3>
          <div class="relative shrink-0 ml-2" data-controller="collapsible">
            <button type="button" data-action="collapsible#toggle" class="text-earth-400 hover:text-earth-600 p-1">
              <svg data-collapsible-target="icon" class="w-5 h-5 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </button>
            <div data-collapsible-target="content" class="hidden absolute right-0 mt-2 w-80 bg-white border border-earth-200 rounded-lg shadow-lg p-4 z-10 text-left">
              <p class="text-sm text-earth-600 mb-3">${this.escape(t(`${base}.description`))}</p>
            </div>
          </div>
        </div>

        <input type="hidden" name="form_responses[${key}]" value="${value ?? ""}" data-question-target="hiddenInput">

        <div class="grid grid-cols-5 sm:gap-2 gap-1.5">${buttons}</div>

        <div class="mt-3 space-y-1.5 text-sm">
          <div data-question-target="descLow" class="p-2.5 rounded-lg border transition-all ${value !== undefined && value <= 3 ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200" : descClass(false) || "bg-rose-50/50 border-rose-100 text-rose-600/80"}">
            <span class="font-medium">1-3:</span> ${this.escape(t(`${base}.scoring.low`))}
          </div>
          <div data-question-target="descMedium" class="p-2.5 rounded-lg border transition-all ${value !== undefined && value >= 4 && value <= 7 ? "bg-mustard-50 border-mustard-300 text-mustard-700 ring-2 ring-mustard-200" : descClass(false) || "bg-mustard-50/50 border-mustard-100 text-mustard-600/80"}">
            <span class="font-medium">4-7:</span> ${this.escape(t(`${base}.scoring.medium`))}
          </div>
          <div data-question-target="descHigh" class="p-2.5 rounded-lg border transition-all ${value !== undefined && value >= 8 ? "bg-forest-50 border-forest-300 text-forest-700 ring-2 ring-forest-200" : descClass(false) || "bg-forest-50/50 border-forest-100 text-forest-600/80"}">
            <span class="font-medium">8-10:</span> ${this.escape(t(`${base}.scoring.high`))}
          </div>
        </div>
      </div>`
  }

  updateProgress() {
    const total = this.config.indicators.length
    const scored = this.config.indicators.filter((indicator) => this.responses[indicator.key] !== undefined).length
    this.progressTextTarget.textContent = t("questionnaire.indicators_count", { answered: scored, total })
    this.progressBarTarget.style.width = `${total ? Math.round((scored * 100) / total) : 0}%`
  }

  checkIcon() {
    return `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>`
  }

  escape(text) {
    const div = document.createElement("div")
    div.textContent = text ?? ""
    return div.innerHTML
  }

  hydrateFarmFields() {
    FARM_FIELDS.forEach((field) => {
      const input = this.element.querySelector(`[data-farm-field="${field}"]`)
      if (input && this.form[field] != null) input.value = this.form[field]
    })
    const selected = this.form.system_types || []
    this.element.querySelectorAll('[data-farm-field="system_types"]').forEach((box) => {
      box.checked = selected.includes(box.value)
    })
  }
}
