import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyServerForm, db, getForm, getResponses, queueEntries } from "lib/db"
import { hydrateForm, syncNow } from "lib/sync"
import FormEditorController from "controllers/form_editor_controller"
import QuestionController from "controllers/question_controller"
import GeolocationController from "controllers/geolocation_controller"
import { clearDb } from "../support/db"
import { resetHead, signIn } from "../support/dom"
import { stubFetch } from "../support/fetch"
import { seedQuestionnaire } from "../support/questionnaire"
import { mount, settle, unmount } from "../support/stimulus"

vi.mock("lib/sync", async (importOriginal) => ({
  ...(await importOriginal()),
  syncNow: vi.fn(),
  hydrateForm: vi.fn()
}))

const clientId = "form-1"

function editor({ id = clientId, formsUrl = "/forms" } = {}) {
  return `
    <div data-controller="form-editor"
         data-form-editor-client-id-value="${id}"
         data-form-editor-forms-url-value="${formsUrl}">
      <h1 data-form-editor-target="title">New questionnaire</h1>
      <span data-form-editor-target="saveState"></span>
      <span data-form-editor-target="progressText"></span>
      <div data-form-editor-target="progressBar" style="width: 0%"></div>

      <input type="text" id="farm_name" data-farm-field="name">
      <select id="farm_gender" data-farm-field="gender">
        <option value=""></option>
        <option value="female">Female</option>
      </select>
      <input type="number" id="farm_work_force" data-farm-field="work_force">
      <input type="checkbox" value="agriculture" data-farm-field="system_types">
      <input type="checkbox" value="forestry" data-farm-field="system_types">
      <div data-controller="geolocation">
        <input type="number" id="farm_latitude" data-farm-field="latitude" data-geolocation-target="latitude">
        <input type="number" id="farm_longitude" data-farm-field="longitude" data-geolocation-target="longitude">
        <button type="button" data-action="geolocation#locate" data-geolocation-target="button">Use GPS</button>
      </div>
      <select id="farm_territory_key" data-farm-field="territory_key">
        <option value=""></option>
        <option value="andes">Andes</option>
        <option value="coast">Coast</option>
        <option value="puna">Puna</option>
      </select>

      <nav data-form-editor-target="dimensionNav"></nav>
      <div data-form-editor-target="indicators"><p>Loading questionnaire</p></div>

      <button type="button" data-form-editor-target="prevButton" data-action="form-editor#previousDimension">Previous</button>
      <button type="button" data-form-editor-target="nextButton" data-action="form-editor#nextDimension">Next</button>
      <form action="#" method="post" data-form-editor-target="completeForm">
        <button type="submit" data-form-editor-target="completeButton" disabled>Complete</button>
      </form>
      <p class="hidden" data-form-editor-target="completeHint">Connect to complete</p>
    </div>`
}

const controllers = { "form-editor": FormEditorController, question: QuestionController }
const target = (name) => document.querySelector(`[data-form-editor-target="${name}"]`)
const field = (name) => document.querySelector(`[data-farm-field="${name}"]`)
const navLabels = () => Array.from(target("dimensionNav").querySelectorAll("button")).map((b) => b.textContent.trim())
const titleOf = (h3) => h3.firstChild.textContent
const badgeOf = (h3) => h3.querySelector("span")?.textContent
const cardTitles = () => Array.from(target("indicators").querySelectorAll("h3")).map(titleOf)

function card(name) {
  return Array.from(target("indicators").querySelectorAll('[data-controller="question"]'))
    .find((element) => titleOf(element.querySelector("h3")) === name)
}

function hintRow(name, rangeTarget) {
  return card(name).querySelector(`[data-question-target="${rangeTarget}"]`)
}

function showSection(index) {
  target("dimensionNav").querySelectorAll("button")[index].click()
  return settle()
}

function score(name, value) {
  card(name).querySelector(`[data-value="${value}"]`).click()
}

function edit(input, value) {
  input.value = value
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

async function seedForm(overrides = {}, responses = []) {
  await applyServerForm({
    client_id: clientId,
    name: "La Esperanza",
    state: "draft",
    territory_key: "andes",
    updated_at: "2026-05-01T12:00:00.000Z",
    responses,
    ...overrides
  })
}

function response(key, value, isExtension = false) {
  return { indicator_key: key, value, is_extension: isExtension }
}

const allScored = [
  response("diversity", 4), response("recycling", 6),
  response("compaction", 5, true), response("erosion", 6, true),
  response("organic_matter", 7, true), response("irrigation", 8, true)
]

beforeEach(async () => {
  await clearDb(db)
  await seedQuestionnaire()
  signIn("editor-token")
  syncNow.mockReset().mockResolvedValue(undefined)
  hydrateForm.mockReset().mockResolvedValue(true)
  vi.stubGlobal("Turbo", { visit: vi.fn() })
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(async () => {
  await unmount()
  resetHead()
  delete navigator.geolocation
  history.replaceState(null, "", "/")
})

describe("form editor controller", () => {
  describe("on a new form", () => {
    it("assigns a client id and rewrites the URL to that form's edit path", async () => {
      await mount(editor({ id: "" }), controllers)

      expect(window.location.pathname).toMatch(/^\/forms\/[0-9a-f-]{36}\/edit$/)
    })

    it("inserts the path segments before the forms URL query string", async () => {
      await mount(editor({ id: "", formsUrl: "/forms?locale=es" }), controllers)

      expect(window.location.pathname).toMatch(/^\/forms\/[0-9a-f-]{36}\/edit$/)
      expect(window.location.search).toBe("?locale=es")
    })

    it("does not store the form until something is entered", async () => {
      await mount(editor({ id: "" }), controllers)

      expect(await db.forms.count()).toBe(0)
    })
  })

  it("leaves the URL alone when editing an existing form", async () => {
    history.replaceState(null, "", "/forms/form-1/edit")
    await seedForm()

    await mount(editor(), controllers)

    expect(window.location.pathname).toBe("/forms/form-1/edit")
  })

  it("redirects a completed form to its results page, keeping the query string", async () => {
    await seedForm({ state: "completed" })

    await mount(editor({ formsUrl: "/forms?locale=es" }), controllers)

    expect(window.Turbo.visit).toHaveBeenCalledWith("/forms/form-1?locale=es")
    expect(target("dimensionNav").innerHTML).toBe("")
  })

  it("explains that the questionnaire is unavailable when the config is not cached offline", async () => {
    await db.questionnaire_config.clear()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    await mount(editor(), controllers)

    expect(target("indicators").textContent).toContain("Questionnaire not available offline")
  })

  describe("rendering", () => {
    it("fills the farm fields, title, and system checkboxes from the stored form", async () => {
      await seedForm({ gender: "female", work_force: 3, system_types: ["forestry"] })

      await mount(editor(), controllers)

      expect(target("title").textContent).toBe("La Esperanza")
      expect(field("name").value).toBe("La Esperanza")
      expect(field("gender").value).toBe("female")
      expect(field("work_force").value).toBe("3")
      const checked = Array.from(document.querySelectorAll('[data-farm-field="system_types"]:checked'))
      expect(checked.map((box) => box.value)).toEqual(["forestry"])
    })

    it("opens on the principles with saved scores highlighted", async () => {
      await seedForm({}, [response("diversity", 2)])

      await mount(editor(), controllers)

      expect(navLabels()).toEqual(["Principles", "Structure", "Fertility", "Supply"])
      expect(cardTitles()).toEqual(["Diversity", "Recycling"])
      expect(card("Diversity").querySelector('[name="form_responses[diversity]"]').value).toBe("2")
      expect(card("Diversity").querySelector('[data-value="2"]').className).toContain("bg-rose-100")
      expect(target("progressText").textContent).toBe("1 of 6 indicators")
      expect(target("progressBar").style.width).toBe("17%")
    })

    it("shows only the principles until a territory is chosen", async () => {
      await seedForm({ territory_key: null })

      await mount(editor(), controllers)

      expect(navLabels()).toEqual(["Principles"])
      expect(target("indicators").textContent).toContain("Choose a territory to see its indicators")
      expect(target("progressText").textContent).toBe("0 of 2 indicators")
    })

    it("badges each indicator with its source territory, including inherited ones", async () => {
      await seedForm({ territory_key: "coast" })
      await mount(editor(), controllers)

      await showSection(3)

      const badges = Array.from(target("indicators").querySelectorAll("h3")).map((h3) => [titleOf(h3), badgeOf(h3)])
      expect(badges).toEqual([["Irrigation", "Andes extension"], ["Salinity", "Coast extension"]])
    })

    it("shows the low, mid, and high range hints for a question that has them", async () => {
      await seedForm()
      await mount(editor(), controllers)

      await showSection(1)

      const rows = ["descLow", "descMedium", "descHigh"].map((name) => hintRow("Compaction", name).textContent.replace(/\s+/g, " ").trim())
      expect(rows).toEqual(["1-3: Hard to push a rod in", "4-7: A rod goes in with effort", "8-10: Spongy soil"])
    })

    it("renders a label-only question without range hints", async () => {
      await seedForm()
      await mount(editor(), controllers)

      await showSection(1)

      expect(card("Erosion").querySelectorAll('[data-question-target^="desc"]')).toHaveLength(0)
    })

    it("highlights the range hint matching the chosen score", async () => {
      await seedForm()
      await mount(editor(), controllers)
      await showSection(1)

      score("Compaction", 5)
      await settle()

      expect(hintRow("Compaction", "descMedium").className).toContain("ring-mustard-200")
      expect(hintRow("Compaction", "descLow").className).not.toContain("ring-2")
      expect(hintRow("Compaction", "descHigh").className).not.toContain("ring-2")
    })

    it("moves between dimensions with next, previous, and the nav buttons", async () => {
      await seedForm()
      await mount(editor(), controllers)

      expect(target("prevButton").disabled).toBe(true)

      target("nextButton").click()
      await settle()
      expect(cardTitles()).toEqual(["Compaction", "Erosion"])
      expect(target("prevButton").disabled).toBe(false)

      await showSection(3)
      expect(cardTitles()).toEqual(["Irrigation"])
      expect(target("nextButton").classList).toContain("hidden")

      target("prevButton").click()
      expect(cardTitles()).toEqual(["Organic matter"])
    })
  })

  describe("answering an indicator", () => {
    it("saves the score to IndexedDB, queues the form, and triggers a sync", async () => {
      await seedForm()
      await mount(editor(), controllers)

      score("Recycling", 7)

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect(await getResponses(clientId)).toEqual({ recycling: 7 })
      expect(await db.form_responses.get([clientId, "recycling"])).toMatchObject({ is_extension: false })
      expect((await queueEntries()).map((entry) => entry.form_client_id)).toEqual([clientId])
      expect((await getForm(clientId)).dirty).toBe(1)
      expect(target("saveState").textContent).toBe("Saved on this device")
      expect(target("progressText").textContent).toBe("1 of 6 indicators")
    })

    it("stores a brand new form before its first response", async () => {
      await mount(editor({ id: "" }), controllers)
      const newId = window.location.pathname.split("/")[2]

      score("Diversity", 4)

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect(await getForm(newId)).toMatchObject({ client_id: newId, state: "draft" })
      expect(await getResponses(newId)).toEqual({ diversity: 4 })
    })

    it("flags territory indicators as extensions", async () => {
      await seedForm()
      await mount(editor(), controllers)
      await showSection(1)

      score("Compaction", 9)

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      const row = await db.form_responses.get([clientId, "compaction"])
      expect(row).toMatchObject({ value: 9, is_extension: true })
    })
  })

  describe("editing farm information", () => {
    it("persists field changes, queues the form, and retitles the page", async () => {
      await seedForm()
      await mount(editor(), controllers)

      edit(field("name"), "Finca Nueva")

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect((await getForm(clientId)).name).toBe("Finca Nueva")
      expect(await queueEntries()).toHaveLength(1)
      expect(target("title").textContent).toBe("Finca Nueva")
    })

    it("stores cleared fields as null and checked systems as a list", async () => {
      await seedForm({ work_force: 3 })
      await mount(editor(), controllers)

      document.querySelector('[data-farm-field="system_types"][value="agriculture"]').checked = true
      edit(field("work_force"), "")

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      const stored = await getForm(clientId)
      expect(stored.work_force).toBeNull()
      expect(stored.system_types).toEqual(["agriculture"])
    })

    it("persists GPS coordinates filled in by the geolocation controller", async () => {
      const getCurrentPosition = vi.fn((success) => success({ coords: { latitude: -13.4, longitude: -71.85 } }))
      Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true })
      await seedForm()
      await mount(editor(), { ...controllers, geolocation: GeolocationController })

      document.querySelector('[data-action="geolocation#locate"]').click()

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled(), { timeout: 2000 })
      expect(await getForm(clientId)).toMatchObject({ latitude: "-13.400000", longitude: "-71.850000" })
    })

    it("drops answers to the old territory's indicators when the territory changes", async () => {
      await seedForm({}, [response("diversity", 5), response("compaction", 7, true)])
      await mount(editor(), controllers)

      edit(field("territory_key"), "puna")

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect(await getResponses(clientId)).toEqual({ diversity: 5 })
      expect(navLabels()).toEqual(["Principles", "Structure"])
      expect((await getForm(clientId)).territory_key).toBe("puna")
    })

    it("keeps inherited answers when moving to a child territory", async () => {
      await seedForm({}, [response("compaction", 7, true)])
      await mount(editor(), controllers)

      edit(field("territory_key"), "coast")

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect(await getResponses(clientId)).toEqual({ compaction: 7 })
    })

    it("keeps territory answers when the territory is unchanged", async () => {
      await seedForm({}, [response("compaction", 7, true)])
      await mount(editor(), controllers)

      edit(field("name"), "Renamed")

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      expect(await getResponses(clientId)).toEqual({ compaction: 7 })
    })
  })

  describe("completion", () => {
    it("keeps Complete disabled until every principle and territory indicator is scored", async () => {
      await seedForm({}, allScored.slice(1))
      await mount(editor(), controllers)

      expect(target("completeButton").disabled).toBe(true)
      expect(target("completeHint").textContent).toBe("Score every indicator to complete")
      expect(target("completeHint").classList).not.toContain("hidden")

      score("Diversity", 3)

      await vi.waitFor(() => expect(target("completeButton").disabled).toBe(false))
      expect(target("completeHint").classList).toContain("hidden")
    })

    it("keeps Complete disabled offline even when every indicator is scored", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
      await seedForm({}, allScored)

      await mount(editor(), controllers)

      expect(target("completeButton").disabled).toBe(true)
      expect(target("completeHint").textContent).toBe("Connect to complete")
    })

    it("syncs, posts the completion, refreshes the local copy, then visits the results", async () => {
      await seedForm({}, allScored)
      const fetch = stubFetch(async () => ({ ok: true, redirected: true, url: "http://localhost:3000/forms/form-1?locale=es" }))
      let hydrated = false
      let hydratedBeforeVisit = false
      hydrateForm.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
        hydrated = true
        return true
      })
      window.Turbo.visit.mockImplementation(() => { hydratedBeforeVisit = hydrated })
      await mount(editor({ formsUrl: "/forms?locale=es" }), controllers)

      target("completeButton").click()

      await vi.waitFor(() => expect(window.Turbo.visit).toHaveBeenCalled())
      expect(syncNow).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith("/forms/form-1/completion?locale=es", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-Token": "editor-token" })
      }))
      expect(hydrateForm).toHaveBeenCalledWith(clientId)
      expect(hydratedBeforeVisit).toBe(true)
      expect(window.Turbo.visit).toHaveBeenCalledWith("http://localhost:3000/forms/form-1?locale=es", { action: "replace" })
    })

    it("does not post while the form still has unsynced edits", async () => {
      await seedForm({}, allScored)
      await db.forms.update(clientId, { dirty: 1 })
      const fetch = stubFetch()
      await mount(editor(), controllers)

      target("completeButton").click()

      await vi.waitFor(() => expect(syncNow).toHaveBeenCalled())
      await vi.waitFor(() => expect(target("completeButton").disabled).toBe(false))
      expect(fetch).not.toHaveBeenCalled()
      expect(window.Turbo.visit).not.toHaveBeenCalled()
    })

    it("tells the user why completion did not happen", async () => {
      await seedForm({}, allScored)
      stubFetch(async () => ({ ok: false, redirected: false, status: 500 }))
      await mount(editor(), controllers)

      target("completeButton").click()

      await vi.waitFor(() => expect(target("completeButton").disabled).toBe(false))
      expect(target("completeHint").classList).not.toContain("hidden")
      expect(target("completeHint").textContent).toBe("Connect to complete")
    })

    it("re-enables Complete when the server rejects the completion", async () => {
      await seedForm({}, allScored)
      stubFetch(async () => ({ ok: false, redirected: false, status: 500 }))
      await mount(editor(), controllers)

      target("completeButton").click()

      await vi.waitFor(() => expect(target("completeButton").disabled).toBe(false))
      expect(hydrateForm).not.toHaveBeenCalled()
      expect(window.Turbo.visit).not.toHaveBeenCalled()
    })
  })
})
