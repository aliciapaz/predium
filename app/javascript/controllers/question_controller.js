import { Controller } from "@hotwired/stimulus"

// Highlighting lives in CSS (score-option, rubric-row); the radio's change
// event carries the answer to the form editor. This controller only moves the
// agent along: the first tap on a question brings the next one into view.
// Corrections and keyboard answers stay put: arrow keys change the radio on
// every step, and scrolling mid-choice would pull the group out of view.
export default class extends Controller {
  connect() {
    this.hasAnswer = this.element.querySelector("input[type=radio]:checked") !== null
  }

  pointed() {
    this.byPointer = true
  }

  answered() {
    const byPointer = this.byPointer
    this.byPointer = false
    if (this.hasAnswer) return
    this.hasAnswer = true
    if (!byPointer) return

    const questions = Array.from(document.querySelectorAll('[data-controller~="question"]'))
    const next = questions[questions.indexOf(this.element) + 1]
    if (next) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "center" }), 150)
  }
}
