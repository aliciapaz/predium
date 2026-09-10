import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["latitude", "longitude", "button"]

  locate() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.")
      return
    }

    if (this.hasButtonTarget) {
      this.buttonTarget.disabled = true
      this.buttonTarget.textContent = "Locating..."
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.setCoordinate(this.latitudeTarget, position.coords.latitude)
        this.setCoordinate(this.longitudeTarget, position.coords.longitude)
        this.resetButton()
      },
      (error) => {
        alert("Unable to retrieve your location. Please enter coordinates manually.")
        this.resetButton()
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

  resetButton() {
    if (this.hasButtonTarget) {
      this.buttonTarget.disabled = false
      this.buttonTarget.textContent = "Use GPS"
    }
  }
}
