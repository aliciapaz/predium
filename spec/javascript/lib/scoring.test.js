import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { parse } from "yaml"
import { calculateScores } from "lib/scoring"

const config = {
  principles: [{ key: "diversity" }, { key: "recycling" }],
  dimensions: [{ key: "structure" }, { key: "fertility" }, { key: "supply" }],
  extensions: {
    andes: {
      indicators: [
        { key: "a", dimension: "structure" },
        { key: "b", dimension: "structure" },
        { key: "c", dimension: "fertility" },
        { key: "d", dimension: "supply" }
      ]
    },
    puna: { indicators: [{ key: "e", dimension: "structure" }] }
  }
}

describe("calculateScores", () => {
  it("averages the territory's indicators into dimensions, rounded to one decimal", () => {
    const { indicatorScores, l2Scores } = calculateScores(config, { a: 3, b: 4, c: 8, d: 6 }, "andes")

    expect(indicatorScores).toEqual({ a: 3, b: 4, c: 8, d: 6 })
    expect(l2Scores).toEqual({ structure: 3.5, fertility: 8, supply: 6 })
  })

  it("takes Level 1 straight from the principle answers, null when unanswered", () => {
    const { l1Scores } = calculateScores(config, { diversity: 7 }, "andes")

    expect(l1Scores).toEqual({ diversity: 7, recycling: null })
  })

  it("treats unanswered indicators as null and leaves them out of the averages", () => {
    const { indicatorScores, l2Scores } = calculateScores(config, { a: 7 }, "andes")

    expect(indicatorScores.b).toBeNull()
    expect(l2Scores.structure).toBe(7)
    expect(l2Scores.fertility).toBe(0)
  })

  it("ignores answers outside the form's territory", () => {
    const { indicatorScores, l2Scores } = calculateScores(config, { a: 2, e: 9 }, "puna")

    expect(indicatorScores).toEqual({ e: 9 })
    expect(l2Scores).toEqual({ structure: 9, fertility: 0, supply: 0 })
  })

  it("scores every dimension 0 without a territory", () => {
    const { l2Scores, l1Scores } = calculateScores(config, { a: 5, diversity: 4 }, null)

    expect(l2Scores).toEqual({ structure: 0, fertility: 0, supply: 0 })
    expect(l1Scores.diversity).toBe(4)
  })
})

function loadYaml(path) {
  return parse(readFileSync(path, "utf8"))
}

// Resolves an extension's `extends` chain parent-first, as QuestionnaireConfig
// does for /api/questionnaire, keeping only the keys scoring reads.
function chainIndicators(territory) {
  const extension = loadYaml(`config/questionnaire/extensions/${territory}.yml`)
  const inherited = extension.extends ? chainIndicators(extension.extends) : []
  return [...inherited, ...extension.indicators.map(({ key, dimension }) => ({ key, dimension }))]
}

function questionnaireConfig(territory) {
  const { principles, categories } = loadYaml("config/questionnaire/core.yml")
  return {
    principles,
    dimensions: categories.flatMap((category) => category.dimensions),
    extensions: { [territory]: { indicators: chainIndicators(territory) } }
  }
}

// Same fixture spec/services/scoring_calculator_spec.rb pins the Ruby
// calculator to, so the two implementations cannot drift apart silently.
describe("parity with Scoring::Calculator", () => {
  it("produces the scores in spec/fixtures/scoring_parity.json", () => {
    const fixture = JSON.parse(readFileSync("spec/fixtures/scoring_parity.json", "utf8"))

    const { l2Scores, l1Scores } = calculateScores(
      questionnaireConfig(fixture.territory_key), fixture.responses, fixture.territory_key
    )

    expect(l2Scores).toEqual(fixture.expected.l2_scores)
    expect(l1Scores).toEqual(fixture.expected.l1_scores)
  })
})
