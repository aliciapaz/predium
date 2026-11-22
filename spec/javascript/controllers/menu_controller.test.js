import { afterEach, describe, expect, it, vi } from "vitest"
import MenuController from "controllers/menu_controller"
import { mount, unmount } from "../support/stimulus"

const fixture = `
  <div class="menu" data-controller="menu"
       data-action="keydown->menu#keydown focusout->menu#leave click@window->menu#closeOutside">
    <button type="button" aria-expanded="false" data-menu-target="button" data-action="menu#toggle">Export</button>
    <div data-menu-target="panel" hidden>
      <a href="#xlsx" data-menu-target="item" data-action="menu#choose">Excel</a>
      <a href="#csv" data-menu-target="item" data-action="menu#choose">CSV</a>
    </div>
  </div>
  <button id="outside">Elsewhere</button>`

const button = () => document.querySelector("[data-menu-target=button]")
const panel = () => document.querySelector("[data-menu-target=panel]")
const items = () => [...document.querySelectorAll("[data-menu-target=item]")]
const press = (key, target = document.activeElement) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
const mountMenu = () => mount(fixture, { menu: MenuController })

afterEach(() => unmount())

describe("menu controller", () => {
  it("opens and closes from its button, saying so through aria-expanded", async () => {
    await mountMenu()

    button().click()
    expect(panel().hidden).toBe(false)
    expect(button().getAttribute("aria-expanded")).toBe("true")

    button().click()
    expect(panel().hidden).toBe(true)
    expect(button().getAttribute("aria-expanded")).toBe("false")
  })

  it("closes on a click outside but not on one inside", async () => {
    await mountMenu()
    button().click()

    panel().click()
    expect(panel().hidden).toBe(false)

    document.getElementById("outside").click()
    expect(panel().hidden).toBe(true)
  })

  it("closes on Escape and hands focus back to the button", async () => {
    await mountMenu()
    button().click()
    items()[0].focus()

    press("Escape")

    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(button())
  })

  it("opens from the keyboard and walks the choices with the arrow keys, wrapping round", async () => {
    await mountMenu()
    button().focus()

    press("ArrowDown")
    expect(panel().hidden).toBe(false)
    expect(document.activeElement).toBe(items()[0])

    press("ArrowDown")
    expect(document.activeElement).toBe(items()[1])
    press("ArrowDown")
    expect(document.activeElement).toBe(items()[0])
    press("ArrowUp")
    expect(document.activeElement).toBe(items()[1])
    press("Home")
    expect(document.activeElement).toBe(items()[0])
  })

  it("lands on the last choice when opened with the up arrow", async () => {
    await mountMenu()
    button().focus()

    press("ArrowUp")

    expect(document.activeElement).toBe(items()[1])
  })

  it("closes when focus tabs out, but not when a click leaves no focus behind", async () => {
    await mountMenu()
    button().click()

    items()[0].dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }))
    expect(panel().hidden).toBe(false)

    items()[1].dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.getElementById("outside") }))
    expect(panel().hidden).toBe(true)
  })

  it("closes once a choice is made and returns focus to the button", async () => {
    await mountMenu()
    button().click()

    items()[1].click()

    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(button())
  })

  it("lines up with the trigger's right edge when the trigger sits on the right", async () => {
    await mountMenu()
    const width = 1024
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(width)
    const rect = vi.spyOn(button(), "getBoundingClientRect")

    rect.mockReturnValue({ left: width - 200, right: width - 40 })
    button().click()
    expect(panel().dataset.align).toBe("end")

    button().click()
    rect.mockReturnValue({ left: 16, right: 180 })
    button().click()
    expect(panel().dataset.align).toBeUndefined()
  })
})
