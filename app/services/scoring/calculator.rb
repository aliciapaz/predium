# frozen_string_literal: true

module Scoring
  # Level 1 = the six principles, scored directly. Level 2 = per-dimension means
  # over the form's resolved territory chain. There is no category rollup.
  # Kept in parity with app/javascript/lib/scoring.js via
  # spec/fixtures/scoring_parity.json.
  class Calculator
    attr_reader :form

    def initialize(form)
      @form = form
    end

    def call
      responses = form.form_responses.index_by(&:indicator_key)
      indicator_scores = build_indicator_scores(responses)

      {
        indicator_scores: indicator_scores,
        l2_scores: build_l2_scores(indicator_scores),
        l1_scores: build_l1_scores(responses),
      }
    end

    private

    def build_l1_scores(responses)
      QuestionnaireConfig.principle_keys.index_with { |key| responses[key]&.value }
    end

    def build_indicator_scores(responses)
      chain_indicators.each_with_object({}) do |ind, hash|
        hash[ind[:key]] = responses[ind[:key]]&.value
      end
    end

    def build_l2_scores(indicator_scores)
      QuestionnaireConfig.dimensions.each_with_object({}) do |dim, hash|
        keys = chain_indicators.select { |ind| ind[:dimension] == dim[:key] }.map { |ind| ind[:key] }
        values = keys.filter_map { |key| indicator_scores[key] }
        hash[dim[:key]] = values.any? ? (values.sum.to_f / values.size).round(1) : 0
      end
    end

    def chain_indicators
      @chain_indicators ||= QuestionnaireConfig.extension_indicators(form.territory_key)
    end
  end
end
