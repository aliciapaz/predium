import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu", "button"]

  toggle() {
    const open = this.menuTarget.classList.toggle("hidden") === false
    if (this.hasButtonTarget) this.buttonTarget.setAttribute("aria-expanded", String(open))
  }
}
