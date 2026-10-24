import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QuestionController from "controllers/question_controller"
import { mount, unmount } from "../support/stimulus"

function question(key, checked = null) {
  const options = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<label data-value="${n}"><input type="radio" name="form_responses[${key}]" value="${n}"${n === checked ? " checked" : ""}>${n}</label>`)
    .join("")
  return `<section id="${key}" data-controller="question" data-question data-action="pointerdown->question#pointed change->question#answered">${options}</section>`
}

const option = (key, value) => document.getElementById(key).querySelector(`[data-value="${value}"]`)

function tap(key, value) {
  option(key, value).dispatchEvent(new Event("pointerdown", { bubbles: true }))
  option(key, value).click()
}

// mount() settles on real timers; fake ones only for the scroll delay.
async function mountQuestions(html) {
  await mount(html, { question: QuestionController })
  vi.useFakeTimers()
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(async () => {
  vi.useRealTimers()
  await unmount()
})

describe("question controller", () => {
  it("checks the radio and bubbles a change with the score for the editor to save", async () => {
    await mountQuestions(question("compaction"))
    const changes = []
    document.body.addEventListener("change", (event) => changes.push([event.target.name, event.target.value]))

    option("compaction", 6).click()

    expect(document.querySelector('[name="form_responses[compaction]"]:checked').value).toBe("6")
    expect(changes).toEqual([["form_responses[compaction]", "6"]])
  })

  it("brings the next question into view after the first answer", async () => {
    await mountQuestions(question("compaction") + question("erosion"))

    tap("compaction", 4)
    vi.runAllTimers()

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(Element.prototype.scrollIntoView.mock.contexts[0].id).toBe("erosion")
  })

  it("stays put when an existing answer is corrected", async () => {
    await mountQuestions(question("compaction", 3) + question("erosion"))

    tap("compaction", 8)
    vi.runAllTimers()

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it("stays put for keyboard answers, which change the radio on every arrow press", async () => {
    await mountQuestions(question("compaction") + question("erosion"))

    option("compaction", 4).click()
    vi.runAllTimers()

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it("does not scroll from the last question", async () => {
    await mountQuestions(question("compaction") + question("erosion"))

    tap("erosion", 9)
    vi.runAllTimers()

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})
