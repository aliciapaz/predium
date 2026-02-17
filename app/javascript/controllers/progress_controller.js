import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["bar", "text"]
  static values = { total: Number, completed: Number }

  connect() {
    this.update()
  }

  update() {
    const pct = this.totalValue > 0
      ? Math.round((this.completedValue / this.totalValue) * 100)
      : 0

    if (this.hasBarTarget) {
      this.barTarget.style.width = `${pct}%`
    }
    if (this.hasTextTarget) {
      this.textTarget.textContent = `${this.completedValue}/${this.totalValue} indicators`
    }
  }
}
