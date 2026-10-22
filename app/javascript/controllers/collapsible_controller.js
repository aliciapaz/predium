import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["content", "icon"]

  toggle(event) {
    if (this.hasContentTarget) {
      const open = this.contentTarget.classList.toggle("hidden") === false
      event?.currentTarget?.setAttribute("aria-expanded", String(open))
    }
    if (this.hasIconTarget) {
      this.iconTarget.classList.toggle("rotate-180")
    }
  }
}
