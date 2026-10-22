import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue } from "lib/db"
import { resumeAfterLogin, syncNow } from "lib/sync"
import ConnectivityController from "controllers/connectivity_controller"
import { clearDb } from "../support/db"
import { seedTranslations } from "../support/questionnaire"
import { mount, unmount } from "../support/stimulus"

vi.mock("lib/sync", () => ({ syncNow: vi.fn(), resumeAfterLogin: vi.fn() }))

const fixture = `
  <div data-controller="connectivity"
       data-action="online@window->connectivity#refresh offline@window->connectivity#refresh predium:queue-changed@document->connectivity#refresh predium:sync-status@document->connectivity#syncStatusChanged">
    <span data-connectivity-target="badge">
      <span data-connectivity-target="dot"></span>
      <span data-connectivity-target="label">Online</span>
      <span data-connectivity-target="pending" class="hidden"></span>
    </span>
    <button type="button" data-action="connectivity#syncNow" data-connectivity-target="syncButton" title="Last sync">Sync now</button>
  </div>`

const target = (name) => document.querySelector(`[data-connectivity-target="${name}"]`)

// connect() fires refresh() without awaiting it, so mount() resolves before
// the badge is painted; the dot has no class until the first paint.
async function mountBadge() {
  await mount(fixture, { connectivity: ConnectivityController })
  await vi.waitFor(() => expect(target("dot").className).not.toBe(""))
}

function setOnline(online) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online)
}

beforeEach(async () => {
  await clearDb(db)
  await seedTranslations()
  localStorage.clear()
  syncNow.mockReset()
  resumeAfterLogin.mockReset()
})

afterEach(() => unmount())

describe("connectivity controller", () => {
  it("shows a green online badge with no pending count when the queue is empty", async () => {
    await mountBadge()

    expect(target("label").textContent).toBe("Online")
    expect(target("dot").className).toContain("bg-forest-500")
    expect(target("badge").className).toContain("bg-forest-50")
    expect(target("pending").classList).toContain("hidden")
  })

  it("turns amber and counts queued forms while online with unsynced changes", async () => {
    await enqueue("form-1")
    await enqueue("form-2")

    await mountBadge()

    expect(target("dot").className).toContain("bg-mustard-500")
    expect(target("pending").textContent).toBe("2 pending")
    expect(target("pending").classList).not.toContain("hidden")
  })

  it("shows a red offline badge while offline", async () => {
    setOnline(false)

    await mountBadge()

    expect(target("label").textContent).toBe("Offline")
    expect(target("dot").className).toContain("bg-rose-500")
    expect(target("badge").className).toContain("bg-rose-50")
  })

  it("repaints when the browser goes offline", async () => {
    await mountBadge()

    setOnline(false)
    window.dispatchEvent(new Event("offline"))

    await vi.waitFor(() => expect(target("label").textContent).toBe("Offline"))
  })

  it("updates the pending count when the sync queue changes", async () => {
    await mountBadge()

    await enqueue("form-1")

    await vi.waitFor(() => expect(target("pending").textContent).toBe("1 pending"))
  })

  it("shows the last sync time in the sync button tooltip", async () => {
    localStorage.setItem("predium:last_sync", "2026-05-01T12:00:00.000Z")

    await mountBadge()

    expect(target("syncButton").title).toMatch(/^Last sync: .+2026/)
  })

  it("resumes a paused sync and syncs when Sync now is pressed", async () => {
    await mountBadge()

    target("syncButton").click()

    expect(resumeAfterLogin).toHaveBeenCalled()
    expect(syncNow).toHaveBeenCalled()
    expect(resumeAfterLogin.mock.invocationCallOrder[0]).toBeLessThan(syncNow.mock.invocationCallOrder[0])
  })

  it("refreshes the badge on sync status events", async () => {
    await mountBadge()
    await db.sync_queue.add({ form_client_id: "form-1", queued_at: new Date().toISOString() })

    document.dispatchEvent(new CustomEvent("predium:sync-status", { detail: { status: "finished" } }))

    await vi.waitFor(() => expect(target("pending").textContent).toBe("1 pending"))
  })

  it("keeps the session expired label after a needs_login status until the user retries", async () => {
    await mountBadge()

    document.dispatchEvent(new CustomEvent("predium:sync-status", { detail: { status: "needs_login" } }))
    document.dispatchEvent(new CustomEvent("predium:queue-changed"))
    await vi.waitFor(() => expect(target("label").textContent).toBe("Session expired"))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(target("label").textContent).toBe("Session expired")

    target("syncButton").click()
    document.dispatchEvent(new CustomEvent("predium:queue-changed"))

    await vi.waitFor(() => expect(target("label").textContent).toBe("Online"))
  })
})
