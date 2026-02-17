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
        this.latitudeTarget.value = position.coords.latitude.toFixed(6)
        this.longitudeTarget.value = position.coords.longitude.toFixed(6)
        this.resetButton()
      },
      (error) => {
        alert("Unable to retrieve your location. Please enter coordinates manually.")
        this.resetButton()
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  resetButton() {
    if (this.hasButtonTarget) {
      this.buttonTarget.disabled = false
      this.buttonTarget.textContent = "Use GPS"
    }
  }
}
