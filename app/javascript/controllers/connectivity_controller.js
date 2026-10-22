import { Controller } from "@hotwired/stimulus"
import { pendingCount } from "lib/db"
import { syncNow, resumeAfterLogin } from "lib/sync"
import { load as loadTranslations, t } from "lib/i18n"

// Navbar online/offline badge with unsynced-change count (AC 5.5).
export default class extends Controller {
  static targets = ["badge", "label", "pending", "syncButton"]

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

    this.labelTarget.textContent = online ? t(this.sessionExpired ? "offline.session_expired" : "offline.online") : t("offline.offline")
    this.badgeTarget.dataset.state = !online ? "offline" : this.sessionExpired ? "expired" : pending ? "pending" : "online"

    if (pending > 0) {
      this.pendingTarget.textContent = t(`offline.pending_count.${pending === 1 ? "one" : "other"}`, { count: pending })
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
    if (event.detail.status === "needs_login") this.sessionExpired = true
    this.refresh()
  }

  syncNow() {
    this.sessionExpired = false
    resumeAfterLogin()
    syncNow()
  }
}
