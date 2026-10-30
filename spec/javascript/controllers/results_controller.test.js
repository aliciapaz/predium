import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyServerForm, db, saveResponse } from "lib/db"
import { hydrateForm } from "lib/sync"
import ResultsController from "controllers/results_controller"
import { clearDb } from "../support/db"
import { seedQuestionnaire } from "../support/questionnaire"
import { mount, unmount } from "../support/stimulus"

vi.mock("lib/sync", async (importOriginal) => ({
  ...(await importOriginal()),
  hydrateForm: vi.fn()
}))

const clientId = "form-1"

const shell = (attributes = "") => `
  <div data-controller="results" data-results-client-id-value="${clientId}"${attributes}>
    <div data-results-target="missing" class="hidden">Results unavailable</div>
    <div data-results-target="loadFailed" class="hidden">Could not load</div>
    <div data-results-target="farmInfo"><p>Loading</p></div>
    <div data-results-target="radar"></div>
    <div data-results-target="dimensions"></div>
    <div data-results-target="indicators"></div>
    <a data-results-target="continue" href="/forms/${clientId}/edit" hidden>Continue</a>
  </div>`

const fixture = shell()

function serverForm(overrides = {}) {
  return {
    client_id: clientId,
    name: "La Esperanza",
    state: "completed",
    country: "Peru",
    region: "Cusco",
    locality: "Pisac",
    land_area: "4.5",
    work_force: "3",
    system_types: ["agriculture", "forestry"],
    territory_key: "andes",
    completed_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
    responses: [
      { indicator_key: "diversity", value: 6, is_extension: false },
      { indicator_key: "compaction", value: 2, is_extension: true },
      { indicator_key: "erosion", value: 4, is_extension: true },
      { indicator_key: "organic_matter", value: 9, is_extension: true }
    ],
    ...overrides
  }
}

const target = (name) => document.querySelector(`[data-results-target="${name}"]`)

function embedded(form) {
  return shell(` data-results-form-value="${JSON.stringify(form).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`)
}

function indicatorRow(name) {
  return Array.from(target("indicators").querySelectorAll("span"))
    .find((span) => span.firstChild?.textContent === name).parentElement
}

beforeEach(async () => {
  await clearDb(db)
  await seedQuestionnaire()
  hydrateForm.mockReset().mockResolvedValue(false)
})

afterEach(() => unmount())

describe("results controller", () => {
  describe("for a draft", () => {
    it("shows partial results with a way back to the questionnaire", async () => {
      await applyServerForm(serverForm({ state: "draft", completed_at: null }))

      await mount(fixture, { results: ResultsController })

      expect(target("farmInfo").textContent).toContain("La Esperanza")
      expect(target("continue").hidden).toBe(false)
    })

    it("offers no way back once the form is completed", async () => {
      await applyServerForm(serverForm())

      await mount(fixture, { results: ResultsController })

      expect(target("continue").hidden).toBe(true)
    })
  })

  describe("when the form is not cached on this device", () => {
    it("hydrates it from the server while online and renders it instead of the missing state", async () => {
      hydrateForm.mockImplementation(async (id) => {
        await applyServerForm(serverForm({ client_id: id }))
        return true
      })

      await mount(fixture, { results: ResultsController })

      expect(hydrateForm).toHaveBeenCalledWith(clientId)
      expect(target("missing").classList).toContain("hidden")
      expect(target("farmInfo").querySelector("h1").textContent).toBe("La Esperanza")
    })

    it("says the server could not provide it when it has no copy either", async () => {
      await mount(fixture, { results: ResultsController })

      expect(hydrateForm).toHaveBeenCalledWith(clientId)
      expect(target("loadFailed").classList).not.toContain("hidden")
      expect(target("missing").classList).toContain("hidden")
      expect(target("farmInfo").innerHTML).toBe("")
    })

    it("shows the missing state offline without trying the server", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

      await mount(fixture, { results: ResultsController })

      expect(hydrateForm).not.toHaveBeenCalled()
      expect(target("missing").classList).not.toContain("hidden")
      expect(target("loadFailed").classList).toContain("hidden")
      expect(target("farmInfo").innerHTML).toBe("")
    })
  })

  describe("with the form embedded by the server", () => {
    it("renders it and its scores without touching IndexedDB or the server", async () => {
      await mount(embedded(serverForm()), { results: ResultsController })

      expect(hydrateForm).not.toHaveBeenCalled()
      expect(target("missing").classList).toContain("hidden")
      expect(target("farmInfo").querySelector("h1").textContent).toBe("La Esperanza")
      expect(indicatorRow("Compaction").lastElementChild.textContent).toBe("2")
      expect(await db.forms.count()).toBe(0)
      expect(await db.form_responses.count()).toBe(0)
    })

    it("prefers the embedded copy over one cached on this device", async () => {
      await applyServerForm(serverForm({ name: "Stale copy", responses: [] }))

      await mount(embedded(serverForm()), { results: ResultsController })

      expect(target("farmInfo").querySelector("h1").textContent).toBe("La Esperanza")
      expect(indicatorRow("Compaction").lastElementChild.textContent).toBe("2")
    })
  })

  it("shows the missing state when the questionnaire config is not cached offline", async () => {
    await applyServerForm(serverForm())
    await db.questionnaire_config.clear()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    await mount(fixture, { results: ResultsController })

    expect(target("missing").classList).not.toContain("hidden")
  })

  describe("with the form cached", () => {
    beforeEach(async () => {
      await applyServerForm(serverForm())
    })

    it("does not hit the server", async () => {
      await mount(fixture, { results: ResultsController })

      expect(hydrateForm).not.toHaveBeenCalled()
    })

    it("renders the farm summary with location, state, and facts", async () => {
      await mount(fixture, { results: ResultsController })

      const farmInfo = target("farmInfo")
      expect(farmInfo.querySelector("h1").textContent).toBe("La Esperanza")
      expect(farmInfo.textContent).toContain("Pisac, Cusco, Peru")
      expect(farmInfo.textContent).toContain("Completed")
      expect(farmInfo.textContent).toContain("4.5 ha")
      expect(farmInfo.textContent).toContain("3 people")
      expect(farmInfo.textContent).toContain("Agriculture, Forestry")
    })

    it("escapes farm data instead of injecting it as HTML", async () => {
      await applyServerForm(serverForm({ name: "<img src=x onerror=alert(1)>", locality: "<b>Pisac</b>" }))

      await mount(fixture, { results: ResultsController })

      const farmInfo = target("farmInfo")
      expect(farmInfo.querySelector("img")).toBeNull()
      expect(farmInfo.querySelector("b")).toBeNull()
      expect(farmInfo.querySelector("h1").textContent).toBe("<img src=x onerror=alert(1)>")
    })

    it("renders a colored bar per dimension sized by its score", async () => {
      await mount(fixture, { results: ResultsController })

      const rows = target("dimensions").children
      expect(rows).toHaveLength(3)

      const [structure, fertility, supply] = Array.from(rows).map((row) => ({
        label: row.querySelector("span").textContent,
        bar: row.querySelector(".score-bar"),
        score: row.querySelector("[data-score]").textContent
      }))
      expect(structure).toMatchObject({ label: "Structure", score: "3.0" })
      expect(structure.bar.dataset.band).toBe("low")
      expect(structure.bar.style.width).toBe("30%")
      expect(fertility.score).toBe("9.0")
      expect(fertility.bar.dataset.band).toBe("high")
      expect(supply.score).toBe("-")
      expect(supply.bar.dataset.band).toBeUndefined()
      expect(supply.bar.style.width).toBe("0%")
    })

    it("renders indicator badges colored by score range, with a dash for unanswered ones", async () => {
      await saveResponse(clientId, "irrigation", 6, true)

      await mount(fixture, { results: ResultsController })

      const badgeFor = (name) => indicatorRow(name).lastElementChild
      expect(badgeFor("Compaction").textContent).toBe("2")
      expect(badgeFor("Compaction").dataset.band).toBe("low")
      expect(badgeFor("Erosion").dataset.band).toBe("mid")
      expect(badgeFor("Organic matter").dataset.band).toBe("high")
      expect(badgeFor("Irrigation").textContent).toBe("6")
    })

    it("shows a dash badge for an indicator with no response", async () => {
      await db.form_responses.where({ form_client_id: clientId, indicator_key: "compaction" }).delete()

      await mount(fixture, { results: ResultsController })

      const row = indicatorRow("Compaction")
      expect(row.lastElementChild.textContent).toBe("-")
      expect(row.lastElementChild.dataset.band).toBeUndefined()
    })

    it("names the source territory only for indicators inherited from another one", async () => {
      await applyServerForm(serverForm({ territory_key: "coast" }))

      await mount(fixture, { results: ResultsController })

      expect(indicatorRow("Compaction").querySelector("span span").textContent).toBe("Andes extension")
      expect(indicatorRow("Salinity").querySelector("span span")).toBeNull()
    })

    it("leaves indicators of the form's own territory unbadged", async () => {
      await mount(fixture, { results: ResultsController })

      expect(indicatorRow("Compaction").querySelector("span span")).toBeNull()
    })

    it("renders only the dimensions the form's territory has indicators for", async () => {
      await applyServerForm(serverForm({ territory_key: "puna", responses: [] }))

      await mount(fixture, { results: ResultsController })

      expect(Array.from(target("dimensions").children).map((row) => row.querySelector("span").textContent))
        .toEqual(["Structure"])
    })

    it("mounts the radar chart with translated principle labels and principle scores", async () => {
      await mount(fixture, { results: ResultsController })

      const radar = target("radar").querySelector('[data-controller="radar-chart"]')
      expect(JSON.parse(radar.dataset.radarChartLabelsValue)).toEqual(["Diversity", "Recycling"])
      expect(JSON.parse(radar.dataset.radarChartScoresValue)).toEqual([6, 0])
      expect(radar.querySelector('canvas[data-radar-chart-target="canvas"]')).not.toBeNull()
    })

    it("labels a draft as a draft", async () => {
      await applyServerForm(serverForm({ state: "draft", completed_at: null }))

      await mount(fixture, { results: ResultsController })

      expect(target("farmInfo").textContent).toContain("Draft")
    })
  })
})
