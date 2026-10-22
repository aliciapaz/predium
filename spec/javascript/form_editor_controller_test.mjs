import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { SourceTextModule, SyntheticModule } from "node:vm"

const noop = () => {}
const dependencies = {
  "@hotwired/stimulus": { Controller: class {} },
  "lib/db": {
    newClientId: noop, getForm: async () => ({}), saveForm: noop,
    getResponses: noop, saveResponse: noop, enqueue: noop, pruneDisallowedResponses: noop,
    queueEntries: async () => []
  },
  "lib/config_cache": {
    cachedConfig: noop, principles: noop, territoryIndicators: noop,
    dimensionIndicators: noop, visibleDimensions: noop
  },
  "lib/i18n": {
    load: noop, has: () => false,
    t: (key, values) => values ? `${values.answered}/${values.total}` : key
  },
  "lib/sync": { syncNow: noop, hydrateForm: noop, csrfToken: noop },
  "lib/ui": {
    escape: (text) => String(text ?? ""), icon: () => "", iconButton: () => "",
    badge: (text) => String(text), band: () => null
  }
}

const source = await readFile(new URL("../../app/javascript/controllers/form_editor_controller.js", import.meta.url), "utf8")
const controllerModule = new SourceTextModule(source)
await controllerModule.link((name) => {
  const exports = dependencies[name]
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
  })
})
await controllerModule.evaluate()
const FormEditor = controllerModule.namespace.default

for (const principles of [true, false]) {
  test(`updates the visible ${principles ? "principles" : "dimension"} count without rebuilding cards`, async () => {
    const editor = new FormEditor()
    const indicators = [{ key: "first" }, { key: "second" }]
    Object.assign(editor, {
      currentIndex: 0, responses: {}, form: {}, clientId: "draft",
      dimensions: () => [{ principles, i18n_key: "dimension" }],
      indicatorsFor: () => indicators,
      requiredItems: () => [...indicators, { key: "another_dimension" }],
      isPrinciple: () => principles,
      escape: (text) => text,
      indicatorsTarget: {
        get innerHTML() { return this.html || "" },
        set innerHTML(html) {
          this.html = html
          editor.dimensionProgressTarget.textContent = ""
        }
      },
      dimensionProgressTarget: { textContent: "" },
      progressTextTarget: { textContent: "" },
      progressBarTarget: { style: {} },
      dimensionNavTarget: { innerHTML: "", querySelector: () => null },
      completeButtonTarget: { classList: { toggle: noop } },
      saveStateTarget: { textContent: "" },
      prevButtonTarget: { disabled: false },
      nextButtonTarget: { classList: { toggle: noop } },
      refreshCompleteState: noop
    })
    editor.render()
    assert.equal(editor.dimensionProgressTarget.textContent, "0/2")
    assert.equal(editor.progressTextTarget.textContent, "0/3")
    const initialCards = editor.indicatorsTarget.innerHTML
    editor.renderIndicators = () => assert.fail("Answering must preserve the current cards")

    await editor.persistResponse("first", "5")
    assert.equal(editor.dimensionProgressTarget.textContent, "1/2")
    assert.equal(editor.progressTextTarget.textContent, "1/3")
    await editor.persistResponse("first", "9")
    assert.equal(editor.dimensionProgressTarget.textContent, "1/2")
    await editor.persistResponse("second", "7")
    assert.equal(editor.dimensionProgressTarget.textContent, "2/2")
    assert.equal(editor.progressTextTarget.textContent, "2/3")
    assert.equal(editor.indicatorsTarget.innerHTML, initialCards)
    assert.ok(FormEditor.targets.includes("dimensionProgress"))
    assert.match(initialCards, /data-form-editor-target="dimensionProgress"/)
  })
}
