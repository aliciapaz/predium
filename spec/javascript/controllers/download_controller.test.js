import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DownloadController from "controllers/download_controller"
import MenuController from "controllers/menu_controller"
import { mount, settle, unmount } from "../support/stimulus"

const fixture = `
  <div class="menu" data-controller="menu download"
       data-download-busy-value="Preparing file…"
       data-download-failed-value="Could not download."
       data-download-offline-value="Offline, turns on by itself."
       data-action="click@window->menu#closeOutside download:saved->menu#choose online@window->download#refresh offline@window->download#refresh">
    <button type="button" aria-expanded="false" data-menu-target="button" data-download-target="trigger" data-action="menu#toggle">Export</button>
    <div data-menu-target="panel" hidden>
      <a href="/forms.xlsx" data-menu-target="item" data-download-target="link" data-action="download#save">
        Excel <span class="menu-item-hint">Recommended.</span>
      </a>
      <p id="offline-note" data-download-target="offlineNote"></p>
      <p data-download-target="failedNote"></p>
    </div>
  </div>`

const menu = () => document.querySelector(".menu")
const trigger = () => document.querySelector("button")
const panel = () => document.querySelector("[data-menu-target=panel]")
const link = () => document.querySelector("a[href='/forms.xlsx']")
const hint = () => document.querySelector(".menu-item-hint")
const offlineNote = () => document.querySelector("[data-download-target=offlineNote]")
const failedNote = () => document.querySelector("[data-download-target=failedNote]")
// click() on an <a> is stubbed below to catch the save, so taps dispatch the event.
const tap = (element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
const mountMenu = () => mount(fixture, { menu: MenuController, download: DownloadController })

function fileResponse(type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  return new Response(new Blob(["PK"]), {
    status: 200,
    headers: { "Content-Type": type, "Content-Disposition": 'attachment; filename="predium-2026-11-15.xlsx"' }
  })
}

let saved
beforeEach(() => {
  saved = []
  URL.createObjectURL = vi.fn(() => "blob:export")
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    if (this.download) saved.push(this.download)
  })
})

afterEach(() => unmount())

describe("download controller", () => {
  it("fetches the file in the page, saves it under the server's name and closes the menu", async () => {
    let finish
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve })))
    await mountMenu()
    trigger().click()

    tap(link())
    expect(hint().textContent).toBe("Preparing file…")
    expect(link().getAttribute("aria-busy")).toBe("true")

    finish(fileResponse())
    await settle()

    expect(fetch).toHaveBeenCalledWith(link().href, { credentials: "same-origin" })
    expect(saved).toEqual(["predium-2026-11-15.xlsx"])
    expect(hint().textContent).toBe("Recommended.")
    expect(link().hasAttribute("aria-busy")).toBe(false)
    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(trigger())
  })

  it("keeps the menu open and says so when the download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await mountMenu()
    trigger().click()

    tap(link())
    await settle()

    expect(failedNote().textContent).toBe("Could not download.")
    expect(panel().hidden).toBe(false)
    expect(hint().textContent).toBe("Recommended.")
    expect(saved).toEqual([])
  })

  it("treats a sign-in page in place of the file as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse("text/html; charset=utf-8")))
    await mountMenu()
    trigger().click()

    tap(link())
    await settle()

    expect(failedNote().textContent).toBe("Could not download.")
    expect(saved).toEqual([])
  })

  it("clears an earlier failure on the next try", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(fileResponse()))
    await mountMenu()
    trigger().click()
    tap(link())
    await settle()

    tap(link())
    await settle()

    expect(failedNote().textContent).toBe("")
    expect(saved).toEqual(["predium-2026-11-15.xlsx"])
  })

  it("marks the menu unavailable offline, explains why, and fetches nothing", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    vi.stubGlobal("fetch", vi.fn())
    await mountMenu()
    trigger().click()

    tap(link())
    await settle()

    expect(menu().dataset.state).toBe("unavailable")
    expect(offlineNote().textContent).toBe("Offline, turns on by itself.")
    expect(trigger().getAttribute("aria-describedby")).toBe("offline-note")
    expect(link().getAttribute("aria-disabled")).toBe("true")
    expect(link().getAttribute("aria-describedby")).toBe("offline-note")
    expect(fetch).not.toHaveBeenCalled()
    expect(panel().hidden).toBe(false)
  })

  it("turns back on by itself when the connection returns", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    await mountMenu()

    onLine.mockReturnValue(true)
    window.dispatchEvent(new Event("online"))

    expect(menu().hasAttribute("data-state")).toBe(false)
    expect(offlineNote().textContent).toBe("")
    expect(trigger().hasAttribute("aria-describedby")).toBe(false)
    expect(link().hasAttribute("aria-disabled")).toBe(false)
  })
})
