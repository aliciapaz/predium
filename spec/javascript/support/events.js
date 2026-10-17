const registered = []

export function listen(type, handler) {
  document.addEventListener(type, handler)
  registered.push([type, handler])
}

export function recordEvents(type) {
  const details = []
  listen(type, (event) => details.push(event.detail))
  return details
}

export function removeListeners() {
  registered.splice(0).forEach(([type, handler]) => document.removeEventListener(type, handler))
}
