import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import GeolocationController from "controllers/geolocation_controller"
import { mount, unmount } from "../support/stimulus"

const fixture = `
  <div data-controller="geolocation">
    <input type="number" data-farm-field="latitude" data-geolocation-target="latitude">
    <input type="number" data-farm-field="longitude" data-geolocation-target="longitude">
    <button type="button" data-action="geolocation#locate" data-geolocation-target="button">Use GPS</button>
  </div>`

const input = (name) => document.querySelector(`[data-geolocation-target="${name}"]`)
const button = () => document.querySelector("button")

function stubGeolocation(getCurrentPosition) {
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true })
}

beforeEach(() => {
  vi.stubGlobal("alert", vi.fn())
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
    expect(button().textContent).toBe("Locating...")

    finish({ coords: { latitude: 1, longitude: 2 } })
    expect(button().disabled).toBe(false)
    expect(button().textContent).toBe("Use GPS")
  })

  it("asks for high accuracy with a timeout", async () => {
    const getCurrentPosition = vi.fn()
    stubGeolocation(getCurrentPosition)
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 10000 })
  })

  it("alerts and restores the button when the position cannot be read", async () => {
    stubGeolocation((_success, failure) => failure({ code: 1 }))
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(alert).toHaveBeenCalledWith("Unable to retrieve your location. Please enter coordinates manually.")
    expect(input("latitude").value).toBe("")
    expect(button().disabled).toBe(false)
  })

  it("alerts when the browser has no geolocation support", async () => {
    await mount(fixture, { geolocation: GeolocationController })

    button().click()

    expect(alert).toHaveBeenCalledWith("Geolocation is not supported by your browser.")
    expect(button().disabled).toBe(false)
  })
})
