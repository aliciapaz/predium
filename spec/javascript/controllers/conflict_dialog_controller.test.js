import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ConflictDialogController from "controllers/conflict_dialog_controller"
import { mount, unmount } from "../support/stimulus"

const fixture = `
  <dialog data-controller="conflict-dialog" data-action="predium:conflict@document->conflict-dialog#open">
    <dd data-conflict-dialog-target="localTime"></dd>
    <dd data-conflict-dialog-target="serverTime"></dd>
    <button type="button" data-action="conflict-dialog#takeServer">Use server copy</button>
    <button type="button" data-action="conflict-dialog#keepMine">Keep mine</button>
  </dialog>`

const dialog = () => document.querySelector("dialog")
const button = (action) => document.querySelector(`[data-action="conflict-dialog#${action}"]`)

function raiseConflict(local = { updated_at: "2026-05-01T12:00:00.000Z" }, server = { updated_at: "2026-05-02T08:30:00.000Z" }) {
  const resolve = vi.fn()
  const event = new CustomEvent("predium:conflict", { detail: { local, server, resolve } })
  document.dispatchEvent(event)
  return { event, resolve }
}

// jsdom does not implement the modal dialog API.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function () { this.setAttribute("open", "") })
  HTMLDialogElement.prototype.close = vi.fn(function () { this.removeAttribute("open") })
})

afterEach(() => unmount())

describe("conflict dialog controller", () => {
  it("claims the conflict event and opens with both timestamps", async () => {
    await mount(fixture, { "conflict-dialog": ConflictDialogController })

    const { event } = raiseConflict()

    expect(event.detail.handled).toBe(true)
    expect(dialog().open).toBe(true)
    const localTime = document.querySelector('[data-conflict-dialog-target="localTime"]').textContent
    const serverTime = document.querySelector('[data-conflict-dialog-target="serverTime"]').textContent
    expect(localTime).toBe(new Date("2026-05-01T12:00:00.000Z").toLocaleString("en"))
    expect(serverTime).toBe(new Date("2026-05-02T08:30:00.000Z").toLocaleString("en"))
  })

  it("shows a dash for a side with no timestamp", async () => {
    await mount(fixture, { "conflict-dialog": ConflictDialogController })

    raiseConflict({ updated_at: null })

    expect(document.querySelector('[data-conflict-dialog-target="localTime"]').textContent).toBe("-")
  })

  it("resolves keep and closes when the user keeps their copy", async () => {
    await mount(fixture, { "conflict-dialog": ConflictDialogController })
    const { resolve } = raiseConflict()

    button("keepMine").click()

    expect(resolve).toHaveBeenCalledWith("keep")
    expect(dialog().open).toBe(false)
  })

  it("resolves server and closes when the user takes the server copy", async () => {
    await mount(fixture, { "conflict-dialog": ConflictDialogController })
    const { resolve } = raiseConflict()

    button("takeServer").click()

    expect(resolve).toHaveBeenCalledWith("server")
    expect(dialog().open).toBe(false)
  })

  it("resolves each conflict only once", async () => {
    await mount(fixture, { "conflict-dialog": ConflictDialogController })
    const { resolve } = raiseConflict()

    button("keepMine").click()
    button("takeServer").click()

    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
