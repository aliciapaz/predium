# frozen_string_literal: true

module Scoring
  class Calculator
    attr_reader :form

    def initialize(form)
      @form = form
    end

    def call
      responses = form.form_responses.core.index_by(&:indicator_key)

      indicator_scores = build_indicator_scores(responses)
      l2_scores = build_l2_scores(indicator_scores)
      l1_scores = build_l1_scores(l2_scores)

      {
        indicator_scores: indicator_scores,
        l2_scores: l2_scores,
        l1_scores: l1_scores
      }
    end

    private

    def build_indicator_scores(responses)
      QuestionnaireConfig.core_indicators.each_with_object({}) do |ind, hash|
        response = responses[ind[:key]]
        hash[ind[:key]] = response&.value
      end
    end

    def build_l2_scores(indicator_scores)
      QuestionnaireConfig.dimensions.each_with_object({}) do |dim, hash|
        dim_indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == dim[:key] }
        values = dim_indicators.filter_map { |i| indicator_scores[i[:key]] }
        hash[dim[:key]] = values.any? ? (values.sum.to_f / values.size).round(1) : 0
      end
    end

    def build_l1_scores(l2_scores)
      QuestionnaireConfig.l1_categories.each_with_object({}) do |cat, hash|
        cat_dimensions = QuestionnaireConfig.dimensions.select { |d| d[:category] == cat[:key] }
        dim_avgs = cat_dimensions.filter_map { |d| l2_scores[d[:key]] if l2_scores[d[:key]]&.positive? }
        hash[cat[:key]] = dim_avgs.any? ? (dim_avgs.sum / dim_avgs.size).round(1) : 0
      end
    end
  end
end
