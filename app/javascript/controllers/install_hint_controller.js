import { Controller } from "@hotwired/stimulus"

const DISMISSED_KEY = "predium:install_hint_dismissed"

// Safari deletes a site's IndexedDB after seven days without a visit, unless
// the app was added to the home screen. Only iOS needs telling: other
// browsers keep persisted storage.
export default class extends Controller {
  connect() {
    if (isIosBrowser() && !isInstalled() && !dismissed()) this.element.hidden = false
  }

  dismiss() {
    this.element.hidden = true
    try { localStorage.setItem(DISMISSED_KEY, "1") } catch { /* storage blocked */ }
  }
}

function isIosBrowser() {
  const iPadOnMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || iPadOnMac
}

function isInstalled() {
  return navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches
}

function dismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "1" } catch { return false }
}
