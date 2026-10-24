import { Controller } from "@hotwired/stimulus"
import { t } from "lib/i18n"

export default class extends Controller {
  static targets = ["latitude", "longitude", "button", "label", "error"]

  locate() {
    this.showError(null)
    if (!navigator.geolocation) {
      this.showError(t("farm_info.gps_unsupported"))
      return
    }

    this.setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.setCoordinate(this.latitudeTarget, position.coords.latitude)
        this.setCoordinate(this.longitudeTarget, position.coords.longitude)
        this.setBusy(false)
      },
      () => {
        this.showError(t("farm_info.gps_failed"))
        this.setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Programmatic value changes do not fire input/change, so the form editor
  // never persists them. Dispatch input so the coordinate is saved and queued.
  setCoordinate(target, value) {
    target.value = value.toFixed(6)
    target.dispatchEvent(new Event("input", { bubbles: true }))
  }

  setBusy(busy) {
    if (!this.hasButtonTarget) return
    this.buttonTarget.disabled = busy
    this.buttonTarget.setAttribute("aria-busy", String(busy))
    if (this.hasLabelTarget) this.labelTarget.textContent = t(busy ? "farm_info.locating" : "farm_info.use_gps")
  }

  showError(message) {
    if (!this.hasErrorTarget) return
    this.errorTarget.textContent = message || ""
    this.errorTarget.classList.toggle("hidden", !message)
  }
}
