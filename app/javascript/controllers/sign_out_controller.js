import { Controller } from "@hotwired/stimulus"
import { pendingCount } from "lib/db"

// Signing out keeps unsynced changes on the device, but they only reach the
// server once the same user signs in again, so say so before leaving.
export default class extends Controller {
  static values = { message: String }

  async confirm(event) {
    if (this.confirmed) return
    event.preventDefault()
    const pending = await pendingCount().catch(() => 0)
    if (pending > 0 && !window.confirm(this.messageValue)) return
    this.confirmed = true
    this.element.requestSubmit()
  }
}
