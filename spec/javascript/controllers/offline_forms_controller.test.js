import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyServerForm, db, enqueue, getForm } from "lib/db"
import { syncNow } from "lib/sync"
import OfflineFormsController from "controllers/offline_forms_controller"
import { clearDb } from "../support/db"
import { seedQuestionnaire } from "../support/questionnaire"
import { mount, unmount } from "../support/stimulus"

vi.mock("lib/sync", async (importOriginal) => ({
  ...(await importOriginal()),
  syncNow: vi.fn()
}))

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
    empty: section.querySelector(":scope > p")?.textContent
  }))
}

function cardFor(name) {
  return Array.from(list().querySelectorAll("h3")).find((h3) => h3.textContent === name).closest("article")
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

afterEach(async () => {
  await unmount()
  delete window.Turbo
})

describe("offline forms controller", () => {
  it("keeps the server-rendered list while online", async () => {
    await seedForm("form-1", { name: "Local only" })

    await mount(fixture, { "offline-forms": OfflineFormsController })

    expect(list().querySelector("#server-rendered")).not.toBeNull()
  })

  describe("online", () => {
    function syncFinished(synced) {
      document.dispatchEvent(new CustomEvent("predium:sync-status", { detail: { status: "finished", synced, pending: 0 } }))
    }

    beforeEach(() => {
      window.Turbo = { visit: vi.fn() }
      syncNow.mockReset()
    })

    it("pushes forms still waiting to sync so they can join the list", async () => {
      await seedForm("form-1", { name: "Made offline" })
      await enqueue("form-1")

      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(syncNow).toHaveBeenCalled()
    })

    it("does not start a sync when nothing is waiting", async () => {
      await mount(fixture, { "offline-forms": OfflineFormsController })

      expect(syncNow).not.toHaveBeenCalled()
    })

    it("reloads the list from the server once a sync pushed something", async () => {
      await mount(fixture, { "offline-forms": OfflineFormsController })

      syncFinished(1)

      expect(window.Turbo.visit).toHaveBeenCalledWith(window.location.href, { action: "replace" })
    })

    it("leaves the list alone when a sync had nothing to push", async () => {
      await mount(fixture, { "offline-forms": OfflineFormsController })

      syncFinished(0)

      expect(window.Turbo.visit).not.toHaveBeenCalled()
    })

    it("stops listening once the list is gone", async () => {
      await mount(fixture, { "offline-forms": OfflineFormsController })
      await unmount()

      syncFinished(1)

      expect(window.Turbo.visit).not.toHaveBeenCalled()
    })
  })

  describe("deleting a form", () => {
    const withDeleteForm = `
      <div data-controller="offline-forms">
        <div data-offline-forms-target="list">
          <form data-action="turbo:submit-end->offline-forms#forget" data-offline-forms-client-id-param="form-1"></form>
        </div>
      </div>`

    async function submitEnd(success) {
      await mount(withDeleteForm, { "offline-forms": OfflineFormsController })
      document.querySelector("form").dispatchEvent(new CustomEvent("turbo:submit-end", { bubbles: true, detail: { success } }))
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    it("drops the device copy once the server deleted it", async () => {
      await seedForm("form-1", { name: "Deleted farm" })

      await submitEnd(true)

      expect(await getForm("form-1")).toBeUndefined()
    })

    it("keeps the device copy when the delete failed", async () => {
      await seedForm("form-1", { name: "Kept farm" })

      await submitEnd(false)

      expect(await getForm("form-1")).toMatchObject({ name: "Kept farm" })
    })
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
      expect(cardFor("Draft farm").querySelector(".btn-quiet").textContent).toBe("Continue")
      expect(cardFor("Done farm").querySelector("a").getAttribute("href")).toBe("/forms/done-1")
      expect(cardFor("Done farm").querySelector(".btn-quiet").textContent).toBe("View results")
    })

    it("shows draft progress against the principles plus the form's own territory chain", async () => {
      await seedForm("draft-1", {
        name: "Draft farm",
        territory_key: "andes",
        responses: [{ indicator_key: "compaction", value: 3, is_extension: true }]
      })
      await seedForm("draft-2", { name: "Puna farm", territory_key: "puna" })

      await mount(fixture, { "offline-forms": OfflineFormsController })

      const card = cardFor("Draft farm")
      expect(card.textContent).toContain("1 of 6 indicators")
      expect(card.querySelector(".meter-fill").style.width).toBe("17%")
      expect(cardFor("Puna farm").textContent).toContain("0 of 3 indicators")
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
