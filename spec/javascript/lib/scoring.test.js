import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { parse } from "yaml"
import { calculateScores } from "lib/scoring"

const config = {
  categories: [{ key: "soil" }, { key: "water" }],
  dimensions: [
    { key: "structure", category: "soil" },
    { key: "fertility", category: "soil" },
    { key: "supply", category: "water" }
  ],
  indicators: [
    { key: "a", dimension: "structure" },
    { key: "b", dimension: "structure" },
    { key: "c", dimension: "fertility" },
    { key: "d", dimension: "supply" }
  ]
}

describe("calculateScores", () => {
  it("averages indicators into dimensions and dimensions into categories, rounded to one decimal", () => {
    const { indicatorScores, l2Scores, l1Scores } = calculateScores(config, { a: 3, b: 4, c: 8, d: 6 })

    expect(indicatorScores).toEqual({ a: 3, b: 4, c: 8, d: 6 })
    expect(l2Scores).toEqual({ structure: 3.5, fertility: 8, supply: 6 })
    expect(l1Scores).toEqual({ soil: 5.8, water: 6 })
  })

  it("treats unanswered indicators as null and leaves them out of the averages", () => {
    const { indicatorScores, l2Scores } = calculateScores(config, { a: 7 })

    expect(indicatorScores.b).toBeNull()
    expect(l2Scores.structure).toBe(7)
  })

  it("scores an empty dimension 0 and skips zero dimensions in the category average", () => {
    const { l2Scores, l1Scores } = calculateScores(config, { a: 6 })

    expect(l2Scores.fertility).toBe(0)
    expect(l1Scores.soil).toBe(6)
    expect(l1Scores.water).toBe(0)
  })
})

// Flattens core.yml the way QuestionnaireConfig does for /api/questionnaire,
// keeping only the keys scoring reads.
function coreConfig() {
  const { categories } = parse(readFileSync("config/questionnaire/core.yml", "utf8"))
  const dimensions = categories.flatMap((category) =>
    category.dimensions.map((dimension) => ({ ...dimension, category: category.key }))
  )
  return {
    categories,
    dimensions,
    indicators: dimensions.flatMap((dimension) =>
      dimension.indicators.map((indicator) => ({ key: indicator.key, dimension: dimension.key }))
    )
  }
}

// Same fixture spec/services/scoring_calculator_spec.rb pins the Ruby
// calculator to, so the two implementations cannot drift apart silently.
describe("parity with Scoring::Calculator", () => {
  it("produces the scores in spec/fixtures/scoring_parity.json", () => {
    const fixture = JSON.parse(readFileSync("spec/fixtures/scoring_parity.json", "utf8"))

    const { l2Scores, l1Scores } = calculateScores(coreConfig(), fixture.responses)

    expect(l2Scores).toEqual(fixture.expected.l2_scores)
    expect(l1Scores).toEqual(fixture.expected.l1_scores)
  })
})
