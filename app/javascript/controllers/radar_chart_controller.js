import { Controller } from "@hotwired/stimulus"
import "chart.js"
import { tokenColor } from "lib/ui"

export default class extends Controller {
  static targets = ["canvas"]
  static values = { labels: Array, scores: Array }

  connect() {
    const Chart = globalThis.Chart
    const primary = tokenColor("primary")
    const line = tokenColor("line")
    const font = getComputedStyle(document.body).fontFamily

    this.chart = new Chart(this.canvasTarget, {
      type: "radar",
      data: {
        labels: this.labelsValue.map((label) => wrap(label)),
        datasets: [{
          data: this.scoresValue,
          // Canvas takes 8-digit hex everywhere, color-mix() only in newer engines.
          backgroundColor: `${primary}2e`,
          borderColor: primary,
          borderWidth: 2.5,
          pointBackgroundColor: primary,
          pointBorderColor: tokenColor("surface"),
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        layout: { padding: 4 },
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              backdropColor: "transparent",
              color: tokenColor("muted"),
              font: { family: font, size: 11 }
            },
            grid: { color: line },
            angleLines: { color: line },
            pointLabels: {
              color: tokenColor("ink-soft"),
              font: { family: font, size: 12, weight: "600" }
            }
          }
        }
      }
    })
  }

  disconnect() {
    if (this.chart) {
      this.chart.destroy()
      this.chart = null
    }
  }
}

// Principle names are long and the chart is phone-width; Chart.js draws an
// array label as stacked lines instead of clipping it at the canvas edge. The
// full names are listed under the chart, so three lines are enough here.
function wrap(label, width = 14, maxLines = 3) {
  if (label.length <= width) return label
  const lines = label.split(" ").reduce((acc, word) => {
    const last = acc[acc.length - 1]
    if (last && `${last} ${word}`.length <= width) acc[acc.length - 1] = `${last} ${word}`
    else acc.push(word)
    return acc
  }, [])
  if (lines.length <= maxLines) return lines
  return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]}…`]
}
