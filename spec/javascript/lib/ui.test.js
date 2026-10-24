import { describe, expect, it } from "vitest"
import { averageBand, badge, band, escape, icon, iconButton, tokenColor } from "lib/ui"

describe("ui primitives", () => {
  it("builds a named icon button and refuses one without a label", () => {
    const html = iconButton({ icon: "info", label: "Qué mide este indicador" })

    expect(html).toContain('aria-label="Qué mide este indicador"')
    expect(html).toContain('class="icon-btn"')
    expect(() => iconButton({ icon: "info", label: "" })).toThrow(/needs a label/)
  })

  it("refuses unknown icons", () => {
    expect(() => icon("rocket")).toThrow(/Known icons/)
  })

  it("escapes badge text and refuses unknown tones", () => {
    expect(badge("<b>x</b>", "warning")).toBe('<span class="badge-warning">&lt;b&gt;x&lt;/b&gt;</span>')
    expect(() => badge("x", "info")).toThrow(/not one of/)
  })

  it("bands single answers by the rubric and averages from 7", () => {
    expect([1, 3, 4, 7, 8, 10].map(band)).toEqual(["low", "low", "mid", "mid", "high", "high"])
    expect(band(undefined)).toBeNull()
    expect([3.9, 4, 6.9, 7].map(averageBand)).toEqual(["low", "mid", "mid", "high"])
    expect(averageBand(0)).toBeNull()
  })

  it("reads color tokens and refuses unknown ones", () => {
    document.documentElement.style.setProperty("--color-primary", "#24603a")

    expect(tokenColor("primary")).toBe("#24603a")
    expect(() => tokenColor("gray-500")).toThrow(/Unknown color token/)
  })
})

describe("escape", () => {
  it("is safe inside quoted attributes", () => {
    expect(escape(`a" onfocus='x'`)).toBe("a&quot; onfocus=&#39;x&#39;")
  })
})
