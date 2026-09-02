# frozen_string_literal: true

module Api
  class QuestionnairesController < Api::BaseController
    def show
      render(json: {
        fingerprint: QuestionnaireConfig.fingerprint,
        categories: QuestionnaireConfig.l1_categories,
        dimensions: QuestionnaireConfig.dimensions,
        indicators: QuestionnaireConfig.core_indicators,
        extensions: QuestionnaireConfig.extension_keys.index_with { |key| QuestionnaireConfig.extension(key) },
      })
    end
  end
end
