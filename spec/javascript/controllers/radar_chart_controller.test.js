import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RadarChartController from "controllers/radar_chart_controller"
import { mount, unmount } from "../support/stimulus"

vi.mock("chart.js", () => ({}))

const fixture = `
  <div data-controller="radar-chart"
       data-radar-chart-labels-value='["Soil","Water"]'
       data-radar-chart-scores-value="[6.5,3]">
    <canvas data-radar-chart-target="canvas"></canvas>
  </div>`

let Chart

beforeEach(() => {
  for (const name of ["primary", "line", "surface", "muted", "ink-soft"]) {
    document.documentElement.style.setProperty(`--color-${name}`, "#123456")
  }
  Chart = vi.fn(function () { this.destroy = vi.fn() })
  vi.stubGlobal("Chart", Chart)
})

afterEach(() => unmount())

describe("radar chart controller", () => {
  it("draws a 0 to 10 radar chart of the labels and scores on the canvas", async () => {
    await mount(fixture, { "radar-chart": RadarChartController })

    const [canvas, options] = Chart.mock.calls[0]
    expect(canvas).toBe(document.querySelector("canvas"))
    expect(options.type).toBe("radar")
    expect(options.data.labels).toEqual(["Soil", "Water"])
    expect(options.data.datasets[0].data).toEqual([6.5, 3])
    expect(options.options.scales.r).toMatchObject({ min: 0, max: 10 })
  })

  it("wraps a long label onto lines without cutting any of it", async () => {
    const label = "Bases culturales y conocimiento tradicional en el manejo del sistema"
    await mount(fixture.replace('["Soil","Water"]', JSON.stringify([label, "Water"])), { "radar-chart": RadarChartController })

    const [, options] = Chart.mock.calls[0]
    const lines = options.data.labels[0]
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(" ")).toBe(label)
  })

  it("destroys the chart when disconnected", async () => {
    await mount(fixture, { "radar-chart": RadarChartController })
    const chart = Chart.mock.instances[0]

    await unmount()

    expect(chart.destroy).toHaveBeenCalled()
  })
})
