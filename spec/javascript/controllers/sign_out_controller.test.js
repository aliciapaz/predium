import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue } from "lib/db"
import SignOutController from "controllers/sign_out_controller"
import { clearDb } from "../support/db"
import { mount, unmount } from "../support/stimulus"

const html = `
  <form action="/users/sign_out" method="post" data-controller="sign-out"
        data-action="submit->sign-out#confirm" data-sign-out-message-value="Unsynced changes stay here">
    <button type="submit">Sign out</button>
  </form>`

let submitted

beforeEach(async () => {
  await clearDb(db)
  submitted = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {})
})

afterEach(async () => { await unmount() })

async function clickSignOut() {
  await mount(html, { "sign-out": SignOutController })
  const event = new Event("submit", { cancelable: true })
  document.querySelector("form").dispatchEvent(event)
  await vi.waitFor(() => expect(event.defaultPrevented).toBe(true))
  await new Promise((resolve) => setTimeout(resolve, 10))
}

describe("sign out", () => {
  it("signs out without asking when nothing is waiting to sync", async () => {
    const confirm = vi.spyOn(window, "confirm")

    await clickSignOut()

    expect(confirm).not.toHaveBeenCalled()
    expect(submitted).toHaveBeenCalled()
  })

  it("warns before signing out with unsynced changes", async () => {
    await enqueue("offline-form")
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)

    await clickSignOut()

    expect(confirm).toHaveBeenCalledWith("Unsynced changes stay here")
    expect(submitted).not.toHaveBeenCalled()
  })

  it("signs out once the user accepts the warning", async () => {
    await enqueue("offline-form")
    vi.spyOn(window, "confirm").mockReturnValue(true)

    await clickSignOut()

    expect(submitted).toHaveBeenCalled()
  })
})
