// Client-side port of Scoring::Calculator (app/services/scoring/calculator.rb).
// Level 1 = the six principles (direct answers); Level 2 = per-dimension means
// over the form's resolved territory chain; no category rollup. The Ruby version
// remains for PDF generation; parity is pinned by spec/fixtures/scoring_parity.json.
function round1(value) {
  return Math.round(value * 10) / 10
}

function chainIndicators(config, territoryKey) {
  if (!territoryKey || !config.extensions || !config.extensions[territoryKey]) return []
  return config.extensions[territoryKey].indicators || []
}

export function calculateScores(config, responses, territoryKey) {
  const chain = chainIndicators(config, territoryKey)

  const indicatorScores = {}
  chain.forEach((indicator) => {
    const value = responses[indicator.key]
    indicatorScores[indicator.key] = value === undefined ? null : value
  })

  const l2Scores = {}
  config.dimensions.forEach((dimension) => {
    const values = chain
      .filter((indicator) => indicator.dimension === dimension.key)
      .map((indicator) => indicatorScores[indicator.key])
      .filter((value) => value !== null)
    l2Scores[dimension.key] = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : 0
  })

  const l1Scores = {}
  ;(config.principles || []).forEach((principle) => {
    const value = responses[principle.key]
    l1Scores[principle.key] = value === undefined ? null : value
  })

  return { indicatorScores, l2Scores, l1Scores }
}
