import { Controller } from "@hotwired/stimulus"
import { newClientId, getForm, saveForm, getResponses, saveResponse, enqueue, pruneDisallowedResponses, queueEntries } from "lib/db"
import { cachedConfig, principles, territoryIndicators, dimensionIndicators, visibleDimensions } from "lib/config_cache"
import { load as loadTranslations, t, has } from "lib/i18n"
import { syncNow, hydrateForm, csrfToken } from "lib/sync"
import { badge, band, escape, icon, iconButton } from "lib/ui"

const HYDRATE_TIMEOUT_MS = 4000

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
    "title", "saveState", "progressText", "progressBar", "dimensionNav", "dimensionProgress",
    "indicators", "prevButton", "nextButton", "nextCaption", "completeForm", "completeButton", "completeHint",
    "completeSlot", "missingButton", "farmInfo", "farmInfoCount"
  ]
  static values = { clientId: String, formsUrl: String }

  async connect() {
    this.clientId = this.clientIdValue || newClientId()
    if (!this.clientIdValue) {
      history.replaceState(null, "", this.formPath("/edit"))
    }

    this.config = await cachedConfig()
    await loadTranslations()
    const stored = await this.storedForm()
    this.titleTarget.textContent = stored?.name || t(stored ? "titles.form_edit" : "questionnaire.new_questionnaire")
    if (!this.config) {
      this.indicatorsTarget.innerHTML = `<div class="alert-warning" role="status">${icon("info")}<p>${escape(t("offline.config_unavailable"))}</p></div>`
      return
    }

    this.form = stored || { client_id: this.clientId, state: "draft", system_types: [] }
    if (this.form.state === "completed") {
      window.Turbo.visit(this.formPath())
      return
    }

    this.responses = await getResponses(this.clientId)
    if (await this.dropStaleResponses()) {
      await enqueue(this.clientId)
      syncNow()
    }
    this.currentIndex = this.resumeIndex()

    this.hydrateFarmFields()
    // Returning to a named form is usually about scoring, so the farm details
    // start collapsed; a new form opens on them.
    if (this.hasFarmInfoTarget && this.form.name) this.farmInfoTarget.open = false
    this.updateFarmInfoCount()
    this.element.addEventListener("change", (event) => this.handleChange(event))
    this.element.addEventListener("input", (event) => this.handleInput(event))
    this.completeFormTarget.addEventListener("submit", (event) => this.handleComplete(event))

    this.render()
  }

  // Same self-heal as the results view: the window-load seed may not have run
  // (Turbo navigation) or may still be racing this read, so an existing id with
  // no local copy, or a copy with no answers, is pulled from the server before
  // the editor treats it as a new form. Local unsynced work is never waited on,
// and a slow network cannot hold the editor hostage for more than a moment.
  async storedForm() {
    if (!this.clientIdValue) return null
    const form = await getForm(this.clientId)
    const answered = form && Object.keys(await getResponses(this.clientId)).length > 0
    if (answered || !navigator.onLine || form?.dirty) return form
    if ((await queueEntries()).some((entry) => entry.form_client_id === this.clientId)) return form

    await hydrateForm(this.clientId, { signal: AbortSignal.timeout?.(HYDRATE_TIMEOUT_MS) })
    return getForm(this.clientId)
  }

  // formsUrl may carry a query string (e.g. ?locale=es), so path segments must
  // be inserted before it, never appended after.
  formPath(suffix = "") {
    const url = new URL(this.formsUrlValue, window.location.origin)
    return `${url.pathname.replace(/\/$/, "")}/${this.clientId}${suffix}${url.search}`
  }

  // ── Dimensions ─────────────────────────────────────────

  dimensions() {
    const principlesSection = { key: "principles", i18n_key: "questionnaire.principles_title", principles: true }
    return [principlesSection, ...visibleDimensions(this.config, this.form.territory_key)]
  }

  indicatorsFor(dimension) {
    if (dimension.principles) return principles(this.config)
    return dimensionIndicators(this.config, dimension.key, this.form.territory_key)
  }

  requiredItems() {
    return [...principles(this.config), ...territoryIndicators(this.config, this.form.territory_key)]
  }

  isPrinciple(key) {
    return principles(this.config).some((principle) => principle.key === key)
  }

  previousDimension() {
    if (this.currentIndex > 0) this.showDimension(this.currentIndex - 1)
  }

  nextDimension() {
    if (this.currentIndex < this.dimensions().length - 1) this.showDimension(this.currentIndex + 1)
  }

  showDimension(index) {
    this.currentIndex = index
    if (this.hasFarmInfoTarget && this.form.name) this.farmInfoTarget.open = false
    this.render()
    this.indicatorsTarget.querySelector("h2").scrollIntoView({ behavior: "smooth", block: "start" })
  }

  jumpToMissing() {
    const index = this.firstIncompleteIndex()
    if (index >= 0) this.showDimension(index)
  }

  isDone(dimension) {
    return this.indicatorsFor(dimension).every((indicator) => this.responses[indicator.key] !== undefined)
  }

  firstIncompleteIndex() {
    return this.dimensions().findIndex((dimension) => !this.isDone(dimension))
  }

  // A resumed draft opens where work remains; a fully scored one opens on the
  // last section, where it completes.
  resumeIndex() {
    const index = this.firstIncompleteIndex()
    return index === -1 ? this.dimensions().length - 1 : index
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
    this.updateFarmInfoCount()
    if (this.form.territory_key !== territoryBefore) await this.dropStaleResponses()
    await enqueue(this.clientId)
    this.markSaved()
    if (this.form.name) this.titleTarget.textContent = this.form.name
    if (this.form.territory_key !== territoryBefore) this.render()
    this.refreshCompleteState()
    syncNow()
  }

  // Answers outside the form's current questionnaire must go before the next
  // push, or every sync ships keys the server rejects: the old territory's
  // questions after a territory change, or legacy rows hydrated from the server
  // that no questionnaire knows. Returns true when anything was removed.
  async dropStaleResponses() {
    const allowed = new Set(this.requiredItems().map((item) => item.key))
    const removed = await pruneDisallowedResponses(this.clientId, [...allowed])
    Object.keys(this.responses).forEach((key) => {
      if (!allowed.has(key)) delete this.responses[key]
    })
    return removed > 0
  }

  async persistResponse(key, value) {
    if (!value) return
    const isExtension = !this.isPrinciple(key)
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
    this.refreshCompleteState()
    this.showHint(t("offline.complete_requires_sync"))
  }

  refreshMissingButton() {
    if (!this.hasMissingButtonTarget) return
    const last = this.currentIndex === this.dimensions().length - 1
    this.missingButtonTarget.classList.toggle("hidden", !last || this.firstIncompleteIndex() === -1)
  }

  refreshCompleteState() {
    this.refreshMissingButton()
    const missing = this.requiredItems().filter((item) => this.responses[item.key] === undefined).length
    const online = navigator.onLine
    this.completeButtonTarget.disabled = !(missing === 0 && online)

    if (missing > 0) this.showHint(t(`questionnaire.missing_count.${missing === 1 ? "one" : "other"}`, { count: missing }))
    else if (!online) this.showHint(t("offline.complete_requires_sync"))
    else this.completeHintTarget.classList.add("hidden")
  }

  showHint(text) {
    this.completeHintTarget.textContent = text
    this.completeHintTarget.classList.remove("hidden")
  }

  // ── Rendering ──────────────────────────────────────────

  render() {
    // A territory change can shrink dimensions() (e.g. clearing the territory
    // drops every dimension section); keep currentIndex in range before rendering.
    this.currentIndex = Math.min(this.currentIndex, this.dimensions().length - 1)
    this.renderNav()
    this.renderIndicators()
    this.updateProgress()
    this.refreshCompleteState()
    const dimensions = this.dimensions()
    const last = this.currentIndex === dimensions.length - 1
    this.prevButtonTarget.disabled = this.currentIndex === 0
    this.nextButtonTarget.classList.toggle("hidden", last)
    this.completeButtonTarget.classList.toggle("hidden", !last)
    if (this.hasCompleteSlotTarget) this.completeSlotTarget.classList.toggle("hidden", !last)
    this.refreshMissingButton()
    if (this.hasNextCaptionTarget) {
      this.nextCaptionTarget.textContent = last ? "" : t("questionnaire.next_up", { section: t(dimensions[this.currentIndex + 1].i18n_key) })
    }
  }

  renderNav() {
    // One section needs no navigation; the section header already names it.
    this.dimensionNavTarget.hidden = this.dimensions().length < 2
    this.dimensionNavTarget.innerHTML = this.dimensions().map((dimension, index) => {
      const indicators = this.indicatorsFor(dimension)
      const answered = indicators.filter((indicator) => this.responses[indicator.key] !== undefined).length
      const done = indicators.length > 0 && answered === indicators.length
      const state = done ? "done" : answered > 0 ? "partial" : "todo"
      const progress = indicators.length ? Math.round((answered * 100) / indicators.length) : 0
      const current = index === this.currentIndex ? ' aria-current="step"' : ""

      return `<button type="button" class="section-tab" data-state="${state}"${current} style="--progress: ${progress}%"
                      data-action="form-editor#jump" data-index="${index}"><span class="section-tab-mark">${done ? icon("check") : ""}</span>${escape(t(dimension.i18n_key))}</button>`
    }).join("")
    // Center the current tab by scrolling the strip itself; scrollIntoView
    // would also scroll the page.
    const nav = this.dimensionNavTarget
    const current = nav.querySelector('[aria-current="step"]')
    if (current) nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.clientWidth) / 2
  }

  jump(event) {
    this.showDimension(Number(event.currentTarget.dataset.index))
  }

  renderIndicators() {
    const dimension = this.dimensions()[this.currentIndex]
    const indicators = this.indicatorsFor(dimension)

    const hint = dimension.principles && !this.form.territory_key
      ? `<div class="alert-warning mt-3" role="status">${icon("info")}<p>${escape(t("questionnaire.no_territory_hint"))}</p></div>`
      : ""

    const header = `
      <div>
        <h2 class="page-title scroll-anchor text-2xl">${escape(t(dimension.i18n_key))}</h2>
        <p class="mt-1 text-sm text-muted">
          ${escape(t("questionnaire.section_of", { current: this.currentIndex + 1, total: this.dimensions().length }))},
          <span data-form-editor-target="dimensionProgress"></span>
        </p>${hint}
      </div>`

    this.indicatorsTarget.innerHTML = header + indicators.map((indicator) => this.indicatorCard(indicator)).join("")
  }

  indicatorCard(indicator) {
    const key = indicator.key
    const base = indicator.i18n_key
    const value = this.responses[key]
    const name = `form_responses[${key}]`

    const options = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `
      <label class="score-option" data-band="${band(n)}" data-value="${n}">
        <input type="radio" name="${name}" value="${n}" data-band="${band(n)}"${value === n ? " checked" : ""}>${n}
      </label>`).join("")

    const extension = indicator.extension && indicator.extension !== this.form.territory_key
      ? badge(t(this.config.extensions[indicator.extension].i18n_key), "neutral")
      : ""

    const help = has(`${base}.description`)
      ? `<div class="relative shrink-0 -mt-2 -mr-2" data-controller="collapsible">
          ${iconButton({ icon: "info", label: t("questionnaire.indicator_help"), attrs: 'data-action="collapsible#toggle" aria-expanded="false"' })}
          <div class="popover hidden" data-collapsible-target="content">${escape(t(`${base}.description`))}</div>
        </div>`
      : ""

    const rubric = has(`${base}.scoring.low`)
      ? `<div class="mt-4 flex flex-col gap-2">
          ${[["low", "1-3"], ["mid", "4-7"], ["high", "8-10"]].map(([level, range]) => `
            <p class="rubric-row" data-band="${level}"><b>${range}</b><span>${escape(t(`${base}.scoring.${level === "mid" ? "medium" : level}`))}</span></p>`).join("")}
        </div>`
      : ""

    return `
      <section class="card" data-controller="question" data-question data-action="pointerdown->question#pointed change->question#answered">
        <div class="flex items-start justify-between gap-3 mb-4">
          <h3 id="${escape(key)}-name" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg leading-snug">${escape(t(`${base}.name`))}${extension}</h3>
          ${help}
        </div>
        <fieldset class="score-scale" aria-labelledby="${escape(key)}-name" aria-describedby="${escape(key)}-scale">
          <legend class="sr-only" id="${escape(key)}-scale">${escape(t("questionnaire.score_legend"))}</legend>
          ${options}
        </fieldset>
        ${rubric}
      </section>`
  }

  updateProgress() {
    const required = this.requiredItems()
    const total = required.length
    const scored = required.filter((item) => this.responses[item.key] !== undefined).length
    this.progressTextTarget.textContent = t("questionnaire.indicators_count", { answered: scored, total })
    this.progressBarTarget.style.width = `${total ? Math.round((scored * 100) / total) : 0}%`

    const indicators = this.indicatorsFor(this.dimensions()[this.currentIndex])
    const answered = indicators.filter((indicator) => this.responses[indicator.key] !== undefined).length
    this.dimensionProgressTarget.textContent = t("questionnaire.answered_count", { answered, total: indicators.length })
  }

  updateFarmInfoCount() {
    if (!this.hasFarmInfoCountTarget) return
    const filled = FARM_FIELDS.filter((field) => this.form[field] != null && this.form[field] !== "").length
    this.farmInfoCountTarget.textContent = t("farm_info.fields_filled", { filled, total: FARM_FIELDS.length })
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
