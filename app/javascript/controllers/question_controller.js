import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["optionBtn", "hiddenInput", "descLow", "descMedium", "descHigh"]
  static values = { selected: Number }

  connect() {
    const current = this.hiddenInputTarget.value
    if (current) {
      this.selectedValue = parseInt(current, 10)
      this.highlightSelected()
      this.showDescription()
    }
  }

  select(event) {
    const value = parseInt(event.currentTarget.dataset.value, 10)
    this.selectedValue = value
    this.hiddenInputTarget.value = value
    this.highlightSelected()
    this.showDescription()
    this.scrollToNext()
  }

  highlightSelected() {
    this.optionBtnTargets.forEach((btn) => {
      const val = parseInt(btn.dataset.value, 10)
      const isSelected = val === this.selectedValue

      // Reset classes
      btn.classList.remove(
        "bg-rose-100", "border-rose-500", "text-rose-700", "ring-2", "ring-rose-300",
        "bg-mustard-100", "border-mustard-500", "text-mustard-700", "ring-mustard-300",
        "bg-forest-100", "border-forest-500", "text-forest-700", "ring-forest-300",
        "bg-earth-50", "border-earth-300", "text-earth-600", "hover:bg-earth-100"
      )

      if (isSelected) {
        if (val <= 3) {
          btn.classList.add("bg-rose-100", "border-rose-500", "text-rose-700", "ring-2", "ring-rose-300")
        } else if (val <= 7) {
          btn.classList.add("bg-mustard-100", "border-mustard-500", "text-mustard-700", "ring-2", "ring-mustard-300")
        } else {
          btn.classList.add("bg-forest-100", "border-forest-500", "text-forest-700", "ring-2", "ring-forest-300")
        }
      } else {
        btn.classList.add("bg-earth-50", "border-earth-300", "text-earth-600", "hover:bg-earth-100")
      }
    })
  }

  showDescription() {
    const val = this.selectedValue

    const configs = [
      { target: "descLow", match: val >= 1 && val <= 3, active: "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200", defaultStyle: "bg-rose-50/50 border-rose-100 text-rose-600/80" },
      { target: "descMedium", match: val >= 4 && val <= 7, active: "bg-mustard-50 border-mustard-300 text-mustard-700 ring-2 ring-mustard-200", defaultStyle: "bg-mustard-50/50 border-mustard-100 text-mustard-600/80" },
      { target: "descHigh", match: val >= 8 && val <= 10, active: "bg-forest-50 border-forest-300 text-forest-700 ring-2 ring-forest-200", defaultStyle: "bg-forest-50/50 border-forest-100 text-forest-600/80" }
    ]

    const muted = "bg-earth-50 border-earth-100 text-earth-400"
    const allClasses = [...new Set(configs.flatMap(c => [...c.active.split(" "), ...c.defaultStyle.split(" "), ...muted.split(" ")]))]

    configs.forEach(({ target, match, active }) => {
      const hasTarget = `has${target.charAt(0).toUpperCase() + target.slice(1)}Target`
      if (!this[hasTarget]) return

      const el = this[`${target}Target`]
      el.classList.remove(...allClasses)

      if (match) {
        el.classList.add(...active.split(" "))
      } else {
        el.classList.add(...muted.split(" "))
      }
    })
  }

  scrollToNext() {
    const allQuestions = document.querySelectorAll('[data-controller~="question"]')
    const currentIndex = Array.from(allQuestions).indexOf(this.element)
    const nextQuestion = allQuestions[currentIndex + 1]

    if (nextQuestion) {
      setTimeout(() => {
        nextQuestion.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 150)
    }
  }
}
