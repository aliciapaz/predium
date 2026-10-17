import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyServerForm, db, enqueue } from "lib/db"
import OfflineFormsController from "controllers/offline_forms_controller"
import { clearDb } from "../support/db"
import { seedQuestionnaire } from "../support/questionnaire"
import { mount, unmount } from "../support/stimulus"

const fixture = `
  <div data-controller="offline-forms">
    <div data-offline-forms-target="list"><p id="server-rendered">Server list</p></div>
  </div>`

const list = () => document.querySelector('[data-offline-forms-target="list"]')

function sections() {
  return Array.from(list().querySelectorAll("section")).map((section) => ({
    title: section.querySelector("h2").textContent,
    count: section.querySelector("h2 + span").textContent,
    names: Array.from(section.querySelectorAll("h3")).map((h3) => h3.textContent),
    empty: section.querySelector("p.text-earth-400")?.textContent
  }))
}

function cardFor(name) {
  return Array.from(list().querySelectorAll("h3")).find((h3) => h3.textContent === name).closest(".bg-white")
}

async function seedForm(clientId, overrides = {}) {
  await applyServerForm({
    client_id: clientId,
    state: "draft",
    updated_at: "2026-05-01T12:00:00.000Z",
    responses: [],
    ...overrides
  })
}

beforeEach(async () => {
  await clearDb(db)
  await seedQuestionnaire()
})

afterEach(() => unmount())

describe("offline forms controller", () => {
  it("keeps the server-rendered list while online", async () => {
    await seedForm("form-1", { name: "Local only" })

    await mount(fixture, { "offline-forms": OfflineFormsController })

    expect(list().querySelector("#server-rendered")).not.toBeNull()
  })

  describe("offline", () => {
    beforeEach(() => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    })

    it("lists cached drafts and completed forms in separate sections", async () => {
      await seedForm("draft-1", { name: "Draft farm" })
      await seedForm("done-1", { name: "Done farm", state: "completed" })

      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(sections()).toEqual([
        { title: "Drafts", count: "1", names: ["Draft farm"], empty: undefined },
        { title: "Completed forms", count: "1", names: ["Done farm"], empty: undefined }
      ])
    })

    it("links drafts to the editor and completed forms to their results", async () => {
      await seedForm("draft-1", { name: "Draft farm" })
      await seedForm("done-1", { name: "Done farm", state: "completed" })

      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(cardFor("Draft farm").querySelector("a").getAttribute("href")).toBe("/forms/draft-1/edit")
      expect(cardFor("Draft farm").querySelector("a").textContent).toBe("Continue")
      expect(cardFor("Done farm").querySelector("a").getAttribute("href")).toBe("/forms/done-1")
      expect(cardFor("Done farm").querySelector("a").textContent).toBe("View results")
    })

    it("shows draft progress against the core indicator count", async () => {
      await seedForm("draft-1", {
        name: "Draft farm",
        responses: [{ indicator_key: "compaction", value: 3, is_extension: false }]
      })

      await mount(fixture, { "offline-forms": OfflineFormsController })

      const card = cardFor("Draft farm")
      expect(card.textContent).toContain("1 of 4 indicators")
      expect(card.querySelector(".bg-forest-500").style.width).toBe("25%")
    })

    it("marks forms that are still waiting in the sync queue", async () => {
      await seedForm("draft-1", { name: "Queued farm" })
      await seedForm("draft-2", { name: "Synced farm" })
      await enqueue("draft-1")

      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(cardFor("Queued farm").textContent).toContain("Pending sync")
      expect(cardFor("Synced farm").textContent).not.toContain("Pending sync")
    })

    it("escapes farm names and locations", async () => {
      await seedForm("draft-1", { name: "<img src=x>", region: "<b>Cusco</b>" })

      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(list().querySelector("img")).toBeNull()
      expect(list().querySelector("b")).toBeNull()
      expect(list().querySelector("h3").textContent).toBe("<img src=x>")
    })

    it("shows empty-state messages when nothing is cached", async () => {
      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(sections().map(({ count, empty }) => ({ count, empty }))).toEqual([
        { count: "0", empty: "No drafts yet" },
        { count: "0", empty: "No completed forms yet" }
      ])
    })
  })
})
