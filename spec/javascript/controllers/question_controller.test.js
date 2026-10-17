import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QuestionController from "controllers/question_controller"
import { mount, unmount } from "../support/stimulus"

function question(key, value = "") {
  const buttons = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<button type="button" data-question-target="optionBtn" data-action="question#select" data-value="${n}">${n}</button>`)
    .join("")
  return `
    <div data-controller="question" id="${key}">
      <input type="hidden" name="form_responses[${key}]" value="${value}" data-question-target="hiddenInput">
      ${buttons}
      <div data-question-target="descLow">1-3</div>
      <div data-question-target="descMedium">4-7</div>
      <div data-question-target="descHigh">8-10</div>
    </div>`
}

const within = (key) => document.getElementById(key)
const option = (key, value) => within(key).querySelector(`[data-value="${value}"]`)
const description = (key, name) => within(key).querySelector(`[data-question-target="${name}"]`)

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => unmount())

describe("question controller", () => {
  it("writes the chosen score to the hidden input and dispatches a bubbling change", async () => {
    await mount(question("compaction"), { question: QuestionController })
    const changes = []
    document.body.addEventListener("change", (event) => changes.push(event.target.value))

    option("compaction", 6).click()

    expect(within("compaction").querySelector("input").value).toBe("6")
    expect(changes).toEqual(["6"])
  })

  it.each([
    [2, "rose", "descLow"],
    [5, "mustard", "descMedium"],
    [9, "forest", "descHigh"]
  ])("colors a score of %i %s and highlights its range description", async (value, color, activeDescription) => {
    await mount(question("compaction"), { question: QuestionController })

    option("compaction", value).click()

    expect(option("compaction", value).classList).toContain(`bg-${color}-100`)
    expect(option("compaction", value).classList).toContain("ring-2")
    expect(option("compaction", value === 9 ? 1 : 10).classList).toContain("bg-earth-50")
    for (const name of ["descLow", "descMedium", "descHigh"]) {
      const active = name === activeDescription
      expect(description("compaction", name).classList.contains(`ring-${color}-200`)).toBe(active)
      expect(description("compaction", name).classList.contains("text-earth-400")).toBe(!active)
    }
  })

  it("clears the previous selection's highlight", async () => {
    await mount(question("compaction"), { question: QuestionController })

    option("compaction", 2).click()
    option("compaction", 9).click()

    expect(option("compaction", 2).classList).not.toContain("bg-rose-100")
    expect(option("compaction", 2).classList).toContain("bg-earth-50")
    expect(description("compaction", "descLow").classList).not.toContain("bg-rose-50")
  })

  it("restores the highlight for a value already in the hidden input", async () => {
    await mount(question("compaction", "8"), { question: QuestionController })

    expect(option("compaction", 8).classList).toContain("bg-forest-100")
    expect(description("compaction", "descHigh").classList).toContain("bg-forest-50")
  })

  it("scrolls the next question into view after a selection", async () => {
    await mount(question("compaction") + question("erosion"), { question: QuestionController })
    vi.useFakeTimers()

    option("compaction", 4).click()
    vi.advanceTimersByTime(150)
    vi.useRealTimers()

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(within("erosion"))
  })
})
