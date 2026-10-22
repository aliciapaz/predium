import { afterEach, describe, expect, it, vi } from "vitest"
import AdminSidebarController from "controllers/admin_sidebar_controller"
import CollapsibleController from "controllers/collapsible_controller"
import DismissibleController from "controllers/dismissible_controller"
import NavbarController from "controllers/navbar_controller"
import { mount, unmount } from "../support/stimulus"

afterEach(() => unmount())

describe("collapsible controller", () => {
  it("toggles the content and rotates the icon", async () => {
    await mount(`
      <div data-controller="collapsible">
        <button type="button" data-action="collapsible#toggle"><svg data-collapsible-target="icon"></svg></button>
        <div data-collapsible-target="content" class="hidden">Details</div>
      </div>`, { collapsible: CollapsibleController })
    const content = document.querySelector('[data-collapsible-target="content"]')
    const icon = document.querySelector('[data-collapsible-target="icon"]')

    document.querySelector("button").click()
    expect(content.classList).not.toContain("hidden")
    expect(icon.classList).toContain("rotate-180")

    document.querySelector("button").click()
    expect(content.classList).toContain("hidden")
    expect(icon.classList).not.toContain("rotate-180")
  })
})

describe("dismissible controller", () => {
  it("removes the flash message", async () => {
    await mount(`
      <div data-controller="dismissible" id="flash">
        <p>Saved</p>
        <button data-action="dismissible#dismiss" aria-label="Dismiss"></button>
      </div>`, { dismissible: DismissibleController })

    document.querySelector("button").click()

    expect(document.getElementById("flash")).toBeNull()
  })
})

describe("navbar controller", () => {
  it("toggles the mobile menu", async () => {
    await mount(`
      <nav data-controller="navbar">
        <button type="button" data-action="navbar#toggle">Menu</button>
        <div class="md:hidden hidden" data-navbar-target="menu"></div>
      </nav>`, { navbar: NavbarController })
    const menu = document.querySelector('[data-navbar-target="menu"]')

    document.querySelector("button").click()
    expect(menu.classList).not.toContain("hidden")

    document.querySelector("button").click()
    expect(menu.classList).toContain("hidden")
  })
})

describe("admin sidebar controller", () => {
  const fixture = `
    <div data-controller="admin-sidebar">
      <div data-admin-sidebar-target="overlay" data-action="click->admin-sidebar#close" class="hidden"></div>
      <aside data-admin-sidebar-target="sidebar" class="hidden md:flex -translate-x-full md:translate-x-0"></aside>
      <button type="button" data-action="admin-sidebar#toggle">Menu</button>
    </div>`
  const sidebar = () => document.querySelector("aside")
  const overlay = () => document.querySelector('[data-admin-sidebar-target="overlay"]')

  it("slides the sidebar in with the overlay", async () => {
    await mount(fixture, { "admin-sidebar": AdminSidebarController })

    document.querySelector("button").click()

    expect(sidebar().classList).toContain("flex")
    expect(overlay().classList).not.toContain("hidden")
    await vi.waitFor(() => expect(sidebar().classList).toContain("translate-x-0"))
    expect(sidebar().classList).not.toContain("-translate-x-full")
  })

  it("slides the sidebar out and hides it when the overlay is clicked", async () => {
    await mount(fixture, { "admin-sidebar": AdminSidebarController })
    document.querySelector("button").click()

    overlay().click()

    expect(overlay().classList).toContain("hidden")
    expect(sidebar().classList).toContain("-translate-x-full")
    await vi.waitFor(() => expect(sidebar().classList).toContain("hidden"))
    expect(sidebar().classList).not.toContain("flex")
  })
})
