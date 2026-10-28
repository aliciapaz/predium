import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import InstallHintController from "controllers/install_hint_controller"
import { mount, unmount } from "../support/stimulus"

const html = `
  <div data-controller="install-hint" hidden>
    <button data-action="install-hint#dismiss">Hide</button>
  </div>`

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"

beforeEach(() => localStorage.clear())

afterEach(async () => {
  await unmount()
  delete navigator.standalone
})

async function render(userAgent) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent)
  await mount(html, { "install-hint": InstallHintController })
  return document.querySelector("[data-controller]")
}

describe("install hint", () => {
  it("asks iPhone users in Safari to add the app to the home screen", async () => {
    expect((await render(IPHONE)).hidden).toBe(false)
  })

  it("stays hidden once the app runs from the home screen", async () => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true })

    expect((await render(IPHONE)).hidden).toBe(true)
  })

  it("stays hidden on other platforms", async () => {
    expect((await render("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36")).hidden).toBe(true)
  })

  it("remembers that the user dismissed it", async () => {
    const hint = await render(IPHONE)
    hint.querySelector("button").click()
    expect(hint.hidden).toBe(true)
    await unmount()

    expect((await render(IPHONE)).hidden).toBe(true)
  })
})
