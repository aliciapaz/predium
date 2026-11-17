import { Controller } from "@hotwired/stimulus"

// Dropdown behind a disclosure button (the `menu` pattern). Closes on Escape,
// on a click or focus outside, and once a choice is made, handing focus back
// to the button so it is not lost with the hidden panel. Arrow keys, Home and
// End move between the choices.
export default class extends Controller {
  static targets = ["button", "panel", "item"]

  toggle() {
    this.isOpen ? this.close() : this.open()
  }

  open() {
    this.panelTarget.hidden = false
    this.buttonTarget.setAttribute("aria-expanded", "true")
    this.align()
  }

  close() {
    this.panelTarget.hidden = true
    this.buttonTarget.setAttribute("aria-expanded", "false")
  }

  closeOutside(event) {
    if (this.isOpen && !this.element.contains(event.target)) this.close()
  }

  // Only focus that lands elsewhere closes it. A click leaves no related
  // target (Safari never focuses a clicked link), and closing then would hide
  // the link before its click lands; closeOutside covers clicks.
  leave(event) {
    if (this.isOpen && event.relatedTarget && !this.element.contains(event.relatedTarget)) this.close()
  }

  choose(event) {
    if (event.defaultPrevented) return
    this.close()
    this.buttonTarget.focus()
  }

  keydown(event) {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (event.key === "Escape" && this.isOpen) {
      this.close()
      this.buttonTarget.focus()
    } else if (step) {
      if (!this.isOpen) this.open()
      this.focusItem(this.itemTargets.indexOf(document.activeElement) + step, step)
    } else if (this.isOpen && (event.key === "Home" || event.key === "End")) {
      this.focusItem(event.key === "Home" ? 0 : -1)
    } else {
      return
    }
    event.preventDefault()
  }

  get isOpen() {
    return !this.panelTarget.hidden
  }

  // From the button (index -1), Down lands on the first choice and Up on the last.
  focusItem(index, step = 1) {
    const items = this.itemTargets
    const from = index < 0 && step < 0 ? items.length - 1 : index
    items[(from + items.length) % items.length]?.focus()
  }

  // Opens toward the middle of the screen: a trigger on the right (a header's
  // actions on desktop) lines the panel up with its right edge, so it stays
  // inside the page column instead of only flipping at the screen edge.
  align() {
    const { left, right } = this.buttonTarget.getBoundingClientRect()
    if ((left + right) / 2 > document.documentElement.clientWidth / 2) {
      this.panelTarget.dataset.align = "end"
    } else {
      delete this.panelTarget.dataset.align
    }
  }
}
