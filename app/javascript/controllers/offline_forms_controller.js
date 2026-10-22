import { Controller } from "@hotwired/stimulus"
import { listForms, getResponses, queueEntries } from "lib/db"
import { cachedConfig, principles, territoryIndicators } from "lib/config_cache"
import { load as loadTranslations, t } from "lib/i18n"
import { badge, escape, icon } from "lib/ui"

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
      ${this.section(t("forms.drafts"), await cards(drafts), drafts.length, "warning", t("forms.no_drafts"))}
      ${this.section(t("forms.completed"), await cards(completed), completed.length, "success", t("forms.no_completed"))}`
  }

  // Mirrors forms/index and forms/_form_card so the offline list matches the
  // server-rendered one.
  section(title, cards, count, tone, emptyMessage) {
    return `<section>
              <div class="flex items-center gap-2 mb-4">
                <h2 class="section-title">${escape(title)}</h2>
                ${badge(count, tone)}
              </div>
              ${count
                ? `<div class="flex flex-col gap-3">${cards}</div>`
                : `<p class="px-6 py-10 rounded-xl border-2 border-dashed border-line text-center text-ink-soft">${escape(emptyMessage)}</p>`}
            </section>`
  }

  card(form, scored, total, isPending) {
    const draft = form.state === "draft"
    const location = [form.region, form.country].filter(Boolean).join(", ")
    const updated = form.updated_at ? new Date(form.updated_at).toLocaleDateString(document.documentElement.lang) : ""
    const percent = total ? Math.round((scored * 100) / total) : 0
    const id = encodeURIComponent(form.client_id)
    const url = draft ? `/forms/${id}/edit` : `/forms/${id}`
    const action = draft ? t("questionnaire.continue") : t("forms.view_results")

    return `<article class="card-flush overflow-hidden">
              <a href="${url}" class="block px-5 pt-4 pb-3">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="text-lg leading-snug min-w-0 break-words">${escape(form.name || "")}</h3>
                  <span class="flex flex-wrap justify-end gap-1">
                    ${badge(t(draft ? "states.draft" : "states.completed"), draft ? "warning" : "success")}
                    ${isPending ? badge(t("offline.pending_sync"), "neutral") : ""}
                  </span>
                </div>
                <p class="mt-1 text-sm text-muted">${escape([location, updated].filter(Boolean).join(", "))}</p>
                ${draft ? `<div class="mt-3 flex items-center gap-3">
                  <div class="meter flex-1"><div class="meter-fill" style="width: ${percent}%"></div></div>
                  <span class="text-sm font-semibold text-ink-soft tabular-nums whitespace-nowrap">${escape(t("questionnaire.indicators_count", { answered: scored, total }))}</span>
                </div>` : ""}
              </a>
              <div class="flex items-center px-2 py-1 border-t border-line-soft">
                <a href="${url}" class="btn-quiet btn-compact">${escape(action)}${icon("chevron_right")}</a>
              </div>
            </article>`
  }
}
