import { Application } from "@hotwired/stimulus"

let application = null
let errors = []

// Stimulus discards the promise an async connect() returns. Keeping it lets a
// test await the IndexedDB reads behind connect instead of polling the DOM.
function tracked(controller) {
  return class extends controller {
    connect() {
      this.connection = Promise.resolve(super.connect())
    }
  }
}

export async function mount(html, controllers) {
  // Every layout renders <html lang>, and controllers hand it straight to
  // toLocaleString, which rejects an empty tag.
  document.documentElement.lang = "en"
  document.body.innerHTML = html
  errors = []
  application = new Application()
  // Stimulus only logs errors thrown by connect or actions; collect them so
  // settle() fails the test instead.
  application.handleError = (error) => errors.push(error)
  Object.entries(controllers).forEach(([identifier, controller]) => {
    application.register(identifier, tracked(controller))
  })
  await application.start()
  await settle()
  return application
}

// Waits for every connected controller, including ones a parent rendered
// while connecting, to finish its connect.
export async function settle() {
  let seen
  do {
    seen = application.controllers
    await Promise.all(seen.map((controller) => controller.connection))
    await new Promise((resolve) => setTimeout(resolve, 0))
  } while (application.controllers.some((controller) => !seen.includes(controller)))
  if (errors.length) throw errors.shift()
}

// Clears the DOM before stopping so Stimulus observes the removal and runs
// each controller's disconnect.
export async function unmount() {
  document.body.innerHTML = ""
  await new Promise((resolve) => setTimeout(resolve, 0))
  application?.stop()
  application = null
  if (errors.length) throw errors.shift()
}
