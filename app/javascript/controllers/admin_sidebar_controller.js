import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["sidebar", "overlay"]

  toggle() {
    if (this.sidebarTarget.classList.contains("hidden")) {
      this.open()
    } else {
      this.close()
    }
  }

  open() {
    this.sidebarTarget.classList.remove("hidden")
    this.sidebarTarget.classList.add("flex")
    this.overlayTarget.classList.remove("hidden")

    requestAnimationFrame(() => {
      this.sidebarTarget.classList.remove("-translate-x-full")
      this.sidebarTarget.classList.add("translate-x-0")
    })
  }

  close() {
    this.sidebarTarget.classList.remove("translate-x-0")
    this.sidebarTarget.classList.add("-translate-x-full")
    this.overlayTarget.classList.add("hidden")

    setTimeout(() => {
      this.sidebarTarget.classList.remove("flex")
      this.sidebarTarget.classList.add("hidden")
    }, 200)
  }
}
