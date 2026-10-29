import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue, saveForm, saveResponse } from "lib/db"
import { claimDevice, releaseDevice } from "lib/device_owner"
import { resumeAfterLogin, syncNow } from "lib/sync"
import { clearDb } from "../support/db"
import { resetHead, signInAs } from "../support/dom"
import { jsonResponse, stubFetch } from "../support/fetch"

vi.mock("lib/device_owner", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, claimDevice: vi.fn(actual.claimDevice) }
})

const { claimDevice: realClaim } = await vi.importActual("lib/device_owner")

beforeEach(async () => {
  await clearDb(db)
  resumeAfterLogin()
  claimDevice.mockImplementation(realClaim)
})

afterEach(() => resetHead())

async function fillOffline(clientId) {
  await saveForm({ client_id: clientId, name: clientId, state: "draft" })
  await saveResponse(clientId, "diversity", 4)
  await enqueue(clientId)
}

// Two tabs share one IndexedDB. A tab still showing agent A claims the device
// back for A from its own stale page, which can land between agent B's claim
// and B's queue read.
describe("another tab claiming the device mid-sync", () => {
  it("never uploads the other agent's work under this session", async () => {
    signInAs("agent-a")
    await realClaim()
    await fillOffline("agent-a-form")
    resetHead()
    await releaseDevice()
    signInAs("agent-b")
    await realClaim()
    await fillOffline("agent-b-form")

    claimDevice.mockImplementationOnce(async () => {
      await realClaim()
      signInAs("agent-a")
      await realClaim()
      signInAs("agent-b")
    })
    const fetch = stubFetch(async (url) => jsonResponse({
      form: { client_id: url.split("/").pop(), state: "draft", updated_at: "2026-10-29T00:00:00.000Z", responses: [] }
    }))

    await syncNow()

    const sent = fetch.mock.calls.map(([url]) => url)
    expect(sent.some((url) => url.includes("agent-a-form"))).toBe(false)
  })
})
