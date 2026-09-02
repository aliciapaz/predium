import { Controller } from "@hotwired/stimulus"
import { pendingCount } from "lib/db"
import { syncNow, resumeAfterLogin } from "lib/sync"
import { load as loadTranslations, t } from "lib/i18n"

// Navbar online/offline badge with unsynced-change count (AC 5.5).
export default class extends Controller {
  static targets = ["badge", "dot", "label", "pending", "syncButton"]

  async connect() {
    await loadTranslations()
    this.refresh()
  }

  async refresh() {
    // Rapid queue events can resolve out of order; only the newest read may paint.
    const token = (this.refreshToken = (this.refreshToken || 0) + 1)
    const online = navigator.onLine
    const pending = await pendingCount()
    if (token !== this.refreshToken) return

    this.labelTarget.textContent = online ? t("offline.online") : t("offline.offline")
    this.dotTarget.className = `w-2 h-2 rounded-full ${online ? (pending ? "bg-mustard-500" : "bg-forest-500") : "bg-rose-500"}`
    this.badgeTarget.className = `inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
      online ? (pending ? "bg-mustard-50 text-mustard-700" : "bg-forest-50 text-forest-700") : "bg-rose-50 text-rose-700"
    }`

    if (pending > 0) {
      this.pendingTarget.textContent = t("offline.pending_count", { count: pending })
      this.pendingTarget.classList.remove("hidden")
    } else {
      this.pendingTarget.classList.add("hidden")
    }

    const lastSync = localStorage.getItem("predium:last_sync")
    if (lastSync) {
      this.syncButtonTarget.title = `${t("offline.last_sync")}: ${new Date(lastSync).toLocaleString(document.documentElement.lang)}`
    }
  }

  syncStatusChanged(event) {
    if (event.detail.status === "needs_login") {
      this.labelTarget.textContent = t("offline.session_expired")
    }
    this.refresh()
  }

  syncNow() {
    resumeAfterLogin()
    syncNow()
  }
}
