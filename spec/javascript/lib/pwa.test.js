import { describe, expect, it, vi } from "vitest"
import { getForm, saveForm } from "lib/db"
import "lib/pwa"

describe("signed-out page load", () => {
  // Devise signs in through Turbo, so the page that purged keeps its db
  // instance into the signed-in session.
  it("purges offline forms and leaves the database usable", async () => {
    await saveForm({ client_id: "previous-user-form", state: "draft" })

    window.dispatchEvent(new Event("load"))

    await vi.waitFor(async () => expect(await getForm("previous-user-form")).toBeUndefined())
    await saveForm({ client_id: "next-user-form", state: "draft" })
    expect(await getForm("next-user-form")).toMatchObject({ client_id: "next-user-form" })
  })
})
