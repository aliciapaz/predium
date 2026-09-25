import { Controller } from "@hotwired/stimulus"
import { listForms, getResponses, queueEntries } from "lib/db"
import { cachedConfig, principles, territoryIndicators } from "lib/config_cache"
import { load as loadTranslations, t } from "lib/i18n"

// Form list: server-rendered when online; hydrated from IndexedDB when the
// cached shell loads offline, so locally created and synced forms both show.
export default class extends Controller {
  static targets = ["list"]

  async connect() {
    if (navigator.onLine) return

    await loadTranslations()
    const config = await cachedConfig()
    const forms = await listForms()
    const pending = new Set((await queueEntries()).map((entry) => entry.form_client_id))

    const drafts = forms.filter((form) => form.state === "draft")
    const completed = forms.filter((form) => form.state === "completed")

    // Total is per-form: principles plus the form's own territory chain.
    const requiredKeys = (form) => [
      ...principles(config).map((p) => p.key),
      ...territoryIndicators(config, form.territory_key).map((i) => i.key),
    ]

    const cards = async (collection) => {
      const rendered = []
      for (const form of collection) {
        const responses = await getResponses(form.client_id)
        const required = config ? requiredKeys(form) : []
        const total = config ? required.length : Object.keys(responses).length
        const scored = config ? required.filter((key) => responses[key] !== undefined).length : Object.keys(responses).length
        rendered.push(this.card(form, scored, total, pending.has(form.client_id)))
      }
      return rendered.join("")
    }

    this.listTarget.innerHTML = `
      ${this.section(t("forms.drafts"), await cards(drafts), drafts.length, "bg-mustard-100 text-mustard-700", t("forms.no_drafts"))}
      ${this.section(t("forms.completed"), await cards(completed), completed.length, "bg-forest-100 text-forest-700", t("forms.no_completed"))}`
  }

  section(title, cards, count, badgeClass, emptyMessage) {
    return `<section class="mb-10">
              <div class="flex items-center gap-2 mb-4">
                <h2 class="text-lg font-semibold text-earth-800">${this.escape(title)}</h2>
                <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}">${count}</span>
              </div>
              ${count ? `<div class="space-y-3">${cards}</div>` : `<p class="text-sm text-earth-400">${this.escape(emptyMessage)}</p>`}
            </section>`
  }

  card(form, scored, total, isPending) {
    const draft = form.state === "draft"
    const stateBadge = draft
      ? `<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-mustard-100 text-mustard-700">${this.escape(t("states.draft"))}</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-forest-100 text-forest-700">${this.escape(t("states.completed"))}</span>`
    const pendingBadge = isPending
      ? `<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-earth-100 text-earth-600">${this.escape(t("offline.pending_sync"))}</span>`
      : ""
    const location = [form.region, form.country].filter(Boolean).join(", ")
    const updated = form.updated_at ? new Date(form.updated_at).toLocaleDateString(document.documentElement.lang) : ""
    const percent = total ? Math.round((scored * 100) / total) : 0
    const url = draft ? `/forms/${form.client_id}/edit` : `/forms/${form.client_id}`
    const action = draft ? t("questionnaire.continue") : t("forms.view_results")

    return `<div class="bg-white border border-earth-200 rounded-lg p-5">
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-semibold text-earth-900 truncate">${this.escape(form.name || "")}</h3>
                ${stateBadge} ${pendingBadge}
              </div>
              <p class="text-sm text-earth-500">${this.escape(location)}${location && updated ? " &middot; " : ""}${this.escape(updated)}</p>
              ${draft ? `<div class="mt-3 flex items-center gap-3">
                <div class="flex-1 bg-earth-100 rounded-full h-1.5 max-w-xs">
                  <div class="bg-forest-500 h-1.5 rounded-full" style="width: ${percent}%"></div>
                </div>
                <span class="text-xs text-earth-500 whitespace-nowrap">${this.escape(t("questionnaire.indicators_count", { answered: scored, total }))}</span>
              </div>` : ""}
              <div class="flex items-center gap-4 mt-4 pt-3 border-t border-earth-100">
                <a href="${url}" class="text-sm font-medium text-forest-600 hover:text-forest-700">${this.escape(action)}</a>
              </div>
            </div>`
  }

  escape(text) {
    const div = document.createElement("div")
    div.textContent = text ?? ""
    return div.innerHTML
  }
}
