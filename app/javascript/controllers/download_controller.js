import { Controller } from "@hotwired/stimulus"

// Fetches a server-made file (the forms exports) in the page instead of
// navigating to it, so the agent sees it being prepared and is told when it
// fails: on a weak signal navigator.onLine stays true and a navigation would
// silently land back on the cached page. Offline is a field agent's normal
// state, so there the links are disabled and a note says they come back on
// their own.
export default class extends Controller {
  static targets = ["link", "trigger", "offlineNote", "failedNote"]
  static values = { busy: String, failed: String, offline: String }

  connect() {
    this.refresh()
  }

  refresh() {
    const offline = !navigator.onLine
    this.offlineNoteTarget.textContent = offline ? this.offlineValue : ""
    if (offline) this.failedNoteTarget.textContent = ""
    toggle(this.element, "data-state", offline && "unavailable")
    toggle(this.triggerTarget, "aria-describedby", offline && this.offlineNoteTarget.id)
    this.linkTargets.forEach((link) => {
      toggle(link, "aria-disabled", offline && "true")
      toggle(link, "aria-describedby", offline && this.offlineNoteTarget.id)
    })
  }

  async save(event) {
    event.preventDefault()
    const link = event.currentTarget
    if (!navigator.onLine || link.getAttribute("aria-busy") === "true") return

    this.failedNoteTarget.textContent = ""
    this.setBusy(link, true)
    try {
      const response = await fetch(link.href, { credentials: "same-origin" })
      // An expired session answers with the sign-in page, not the file.
      if (!response.ok || (response.headers.get("Content-Type") || "").includes("text/html")) {
        throw new Error(`Export failed with ${response.status}`)
      }
      saveBlob(await response.blob(), filename(response) || new URL(link.href).pathname.split("/").pop())
      this.dispatch("saved")
    } catch {
      this.failedNoteTarget.textContent = this.failedValue
    } finally {
      this.setBusy(link, false)
    }
  }

  setBusy(link, busy) {
    const hint = link.querySelector(".menu-item-hint")
    if (busy) {
      link.dataset.hint = hint.textContent
      hint.textContent = this.busyValue
      link.setAttribute("aria-busy", "true")
    } else {
      hint.textContent = link.dataset.hint
      link.removeAttribute("aria-busy")
    }
  }
}

function toggle(element, attribute, value) {
  if (value) element.setAttribute(attribute, value)
  else element.removeAttribute(attribute)
}

function filename(response) {
  return /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1]
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  // Safari reads the blob after click() returns, so revoking at once can empty the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
