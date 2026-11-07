import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db, enqueue, getForm, saveForm, saveResponse } from "lib/db"
import { claimDevice, mayWrite, ownsDevice, releaseDevice } from "lib/device_owner"
import { resumeAfterLogin, seedFromServer, syncNow } from "lib/sync"
import { clearDb } from "../support/db"
import { resetHead, signInAs } from "../support/dom"
import { jsonResponse, stubFetch } from "../support/fetch"

vi.mock("lib/device_owner", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ownsDevice: vi.fn(actual.ownsDevice) }
})

const { ownsDevice: realOwnsDevice } = await vi.importActual("lib/device_owner")

beforeEach(async () => {
  await clearDb(db)
  resumeAfterLogin()
  ownsDevice.mockImplementation(realOwnsDevice)
})

afterEach(() => resetHead())

async function bothAgentsHaveWork() {
  signInAs("agent-a")
  await claimDevice()
  await fillOffline("agent-a-form")
  resetHead()
  await releaseDevice()
  signInAs("agent-b")
  await claimDevice()
  await fillOffline("agent-b-form")
}

async function recordedOwner() {
  return (await db.device_meta.get("owner"))?.value
}

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
    await bothAgentsHaveWork()

    ownsDevice.mockImplementationOnce(async () => {
      const owns = await realOwnsDevice()
      signInAs("agent-a")
      await claimDevice()
      signInAs("agent-b")
      return owns
    })
    const fetch = stubFetch(async (url) => jsonResponse({
      form: { client_id: url.split("/").pop(), state: "draft", updated_at: "2026-10-29T00:00:00.000Z", responses: [] }
    }))

    await syncNow()

    const sent = fetch.mock.calls.map(([url]) => url)
    expect(sent.some((url) => url.includes("agent-a-form"))).toBe(false)
  })
})

// A tab left open on agent A keeps firing background syncs after agent B
// signs in elsewhere. Only a freshly rendered page may claim the device.
describe("a stale tab still showing the previous agent", () => {
  it("does not take the device back when it syncs", async () => {
    await bothAgentsHaveWork()
    const fetch = stubFetch()

    signInAs("agent-a")
    await syncNow()
    await seedFromServer()

    expect(await recordedOwner()).toBe("agent-b")
    expect(fetch).not.toHaveBeenCalled()
    expect(await getForm("agent-b-form")).toBeTruthy()
    expect(await getForm("agent-a-form")).toBeUndefined()
  })

  it("may not write into the other agent's stores", async () => {
    await bothAgentsHaveWork()

    signInAs("agent-a")
    expect(await mayWrite()).toBe(false)
    signInAs("agent-b")
    expect(await mayWrite()).toBe(true)
  })

  it("takes an unowned device before writing, keeping the next agent's work apart", async () => {
    signInAs("agent-a")
    await claimDevice()
    resetHead()
    await releaseDevice()

    signInAs("agent-a")
    expect(await mayWrite()).toBe(true)
    expect(await recordedOwner()).toBe("agent-a")
  })
})

describe("a pull that outlasts the session it started in", () => {
  it("drops the response once another agent owns the device", async () => {
    signInAs("agent-a")
    await claimDevice()
    let respond
    stubFetch(() => new Promise((resolve) => { respond = resolve }))

    const pull = seedFromServer()
    await vi.waitFor(() => expect(respond).toBeTypeOf("function"))
    resetHead()
    await releaseDevice()
    signInAs("agent-b")
    await claimDevice()
    respond(jsonResponse({ forms: [{ client_id: "agent-a-farm", name: "A", state: "draft", updated_at: "2026-10-29T00:00:00.000Z", responses: [] }] }))
    await pull

    expect(await getForm("agent-a-farm")).toBeUndefined()
  })
})
