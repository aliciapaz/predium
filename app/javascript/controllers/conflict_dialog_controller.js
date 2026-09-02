import { Controller } from "@hotwired/stimulus"

// Draft conflict dialog (ADR-3 matrix): shows both sides' timestamps and asks
// the user to keep the local copy (re-sent with force) or take the server's.
export default class extends Controller {
  static targets = ["localTime", "serverTime"]

  open(event) {
    event.detail.handled = true
    this.resolve = event.detail.resolve
    this.localTimeTarget.textContent = this.format(event.detail.local.updated_at)
    this.serverTimeTarget.textContent = this.format(event.detail.server.updated_at)
    this.element.showModal()
  }

  keepMine() {
    this.close("keep")
  }

  takeServer() {
    this.close("server")
  }

  close(choice) {
    this.element.close()
    if (this.resolve) this.resolve(choice)
    this.resolve = null
  }

  format(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleString(document.documentElement.lang) : "-"
  }
}
