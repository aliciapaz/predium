# frozen_string_literal: true

module Api
  class QuestionnairesController < Api::BaseController
    def show
      render(json: {
        fingerprint: QuestionnaireConfig.fingerprint,
        principles: QuestionnaireConfig.principles,
        categories: QuestionnaireConfig.l1_categories,
        dimensions: QuestionnaireConfig.dimensions,
        extensions: QuestionnaireConfig.extension_keys.index_with { |key| QuestionnaireConfig.extension(key) },
      })
    end
  end
end
