export function signIn(csrfToken = "test-csrf-token") {
  addMeta("predium-signed-in", "true")
  addMeta("csrf-token", csrfToken)
}

export function resetHead() {
  document.head.innerHTML = ""
}

function addMeta(name, content) {
  const meta = document.createElement("meta")
  meta.name = name
  meta.content = content
  document.head.appendChild(meta)
}
