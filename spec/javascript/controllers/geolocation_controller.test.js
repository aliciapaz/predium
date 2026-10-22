import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "lib/db"
import { load as loadTranslations } from "lib/i18n"
import GeolocationController from "controllers/geolocation_controller"
import { clearDb } from "../support/db"
import { seedTranslations } from "../support/questionnaire"
import { mount, unmount } from "../support/stimulus"

const fixture = `
  <div data-controller="geolocation">
    <input type="number" data-farm-field="latitude" data-geolocation-target="latitude">
    <input type="number" data-farm-field="longitude" data-geolocation-target="longitude">
    <button type="button" data-action="geolocation#locate" data-geolocation-target="button">
      <span data-geolocation-target="label">Use GPS</span>
    </button>
    <p class="hidden" data-geolocation-target="error"></p>
  </div>`

const input = (name) => document.querySelector(`[data-geolocation-target="${name}"]`)
const button = () => document.querySelector("button")
const label = () => document.querySelector('[data-geolocation-target="label"]')
const error = () => document.querySelector('[data-geolocation-target="error"]')

function stubGeolocation(getCurrentPosition) {
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true })
}

beforeEach(async () => {
  await clearDb(db)
  await seedTranslations()
  await loadTranslations()
})

afterEach(async () => {
  await unmount()
  delete navigator.geolocation
})

describe("geolocation controller", () => {
  it("fills both coordinates to six decimals and fires input so the editor saves them", async () => {
    stubGeolocation((success) => success({ coords: { latitude: -13.41234567, longitude: -71.8 } }))
    await mount(fixture, { geolocation: GeolocationController })
    const inputs = []
    document.body.addEventListener("input", (event) => inputs.push(event.target.dataset.farmField))

    button().click()

    expect(input("latitude").value).toBe("-13.412346")
    expect(input("longitude").value).toBe("-71.800000")
    expect(inputs).toEqual(["latitude", "longitude"])
  })

  it("disables the button while locating and restores it afterwards", async () => {
    let finish
    stubGeolocation((success) => { finish = success })
    await mount(fixture, { geolocation: GeolocationController })

    button().click()
    expect(button().disabled).toBe(true)
    expect(label().textContent).toBe("Locating…")

    finish({ coords: { latitude: 1, longitude: 2 } })
    expect(button().disabled).toBe(false)
    expect(label().textContent).toBe("Use GPS")
  })

  it("asks for high accuracy with a timeout", async () => {
    const getCurrentPosition = vi.fn()
    stubGeolocation(getCurrentPosition)
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 10000 })
  })

  it("explains the failure inline and restores the button when the position cannot be read", async () => {
    stubGeolocation((_success, failure) => failure({ code: 1 }))
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(error().textContent).toBe("We could not read your location.")
    expect(error().classList).not.toContain("hidden")
    expect(input("latitude").value).toBe("")
    expect(button().disabled).toBe(false)
  })

  it("explains inline when the device has no geolocation support", async () => {
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(error().textContent).toBe("This device cannot read its location.")
    expect(button().disabled).toBe(false)
  })
})
