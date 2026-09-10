// Client-side port of Scoring::Calculator (app/services/scoring/calculator.rb).
// The Ruby version remains only for PDF generation; parity between the two is
// pinned by spec/fixtures/scoring_parity.json.
function round1(value) {
  return Math.round(value * 10) / 10
}

export function calculateScores(config, responses) {
  const indicatorScores = {}
  config.indicators.forEach((indicator) => {
    const value = responses[indicator.key]
    indicatorScores[indicator.key] = value === undefined ? null : value
  })

  const l2Scores = {}
  config.dimensions.forEach((dimension) => {
    const values = config.indicators
      .filter((indicator) => indicator.dimension === dimension.key)
      .map((indicator) => indicatorScores[indicator.key])
      .filter((value) => value !== null)
    l2Scores[dimension.key] = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : 0
  })

  const l1Scores = {}
  config.categories.forEach((category) => {
    const averages = config.dimensions
      .filter((dimension) => dimension.category === category.key)
      .map((dimension) => l2Scores[dimension.key])
      .filter((value) => value > 0)
    l1Scores[category.key] = averages.length ? round1(averages.reduce((a, b) => a + b, 0) / averages.length) : 0
  })

  return { indicatorScores, l2Scores, l1Scores }
}
