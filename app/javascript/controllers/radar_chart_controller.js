import { Controller } from "@hotwired/stimulus"
import "chart.js"

export default class extends Controller {
  static targets = ["canvas"]
  static values = { labels: Array, scores: Array }

  connect() {
    const Chart = globalThis.Chart

    this.chart = new Chart(this.canvasTarget, {
      type: "radar",
      data: {
        labels: this.labelsValue,
        datasets: [{
          data: this.scoresValue,
          backgroundColor: "rgba(52, 120, 68, 0.15)",
          borderColor: "rgba(52, 120, 68, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(52, 120, 68, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
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
              color: "#78716c",
              font: { size: 11 }
            },
            grid: { color: "rgba(168, 162, 158, 0.3)" },
            angleLines: { color: "rgba(168, 162, 158, 0.3)" },
            pointLabels: {
              color: "#44403c",
              font: { size: 13, weight: "500" }
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
