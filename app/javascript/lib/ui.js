// Layer 2 primitives for markup that Stimulus controllers render. Mirrors
// DesignSystemHelper: each builder throws on invalid composition instead of
// returning inaccessible markup. Styling lives in app/assets/tailwind.

const ICONS = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron_down: '<path d="m6 9 6 6 6-6"/>',
  chevron_right: '<path d="m9 18 6-6-6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5h.01"/>'
}

// Whole class names, never interpolated: Tailwind only generates classes it
// can read in the source.
const BADGE_CLASSES = { neutral: "badge-neutral", success: "badge-success", warning: "badge-warning", danger: "badge-danger" }

// Safe in text and in quoted attribute values (iconButton puts labels in both).
export function escape(text) {
  const div = document.createElement("div")
  div.textContent = text ?? ""
  return div.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

export function icon(name, css = "w-5 h-5") {
  const paths = ICONS[name]
  if (!paths) throw new Error(`Unknown icon "${name}". Known icons: ${Object.keys(ICONS).join(", ")}. Add it to lib/ui.js.`)
  return `<svg class="${css}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

export function iconButton({ icon: name, label, attrs = "" }) {
  if (!label) throw new Error(`iconButton("${name}") needs a label: the icon is not an accessible name.`)
  return `<button type="button" class="icon-btn" aria-label="${escape(label)}" title="${escape(label)}" ${attrs}>${icon(name)}</button>`
}

export function badge(text, tone) {
  const css = BADGE_CLASSES[tone]
  if (!css) throw new Error(`badge tone "${tone}" is not one of ${Object.keys(BADGE_CLASSES).join(", ")}.`)
  return `<span class="${css}">${escape(text)}</span>`
}

// Resolved value of a color token, for canvas drawing that cannot take a class.
export function tokenColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  if (!value) throw new Error(`Unknown color token "${name}". Tokens live in app/assets/tailwind/tokens.css.`)
  return value
}

// Score band for a 1-10 answer: the data-band contract of score-option,
// rubric-row and score-chip. Matches the rubric (1-3, 4-7, 8-10).
export function band(value) {
  if (!value) return null
  if (value <= 3) return "low"
  if (value <= 7) return "mid"
  return "high"
}

// Band for a dimension average (score-bar). Averages count as high from 7,
// one point below single answers, as the results page always has.
export function averageBand(score) {
  if (!score) return null
  if (score >= 7) return "high"
  if (score >= 4) return "mid"
  return "low"
}
