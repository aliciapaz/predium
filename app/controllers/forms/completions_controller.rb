module Forms
  class CompletionsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_form

    def create
      missing = missing_dimensions
      if missing.any?
        flash[:alert] = "Please complete all indicators. Missing: #{missing.map { |d| t(d[:i18n_key]) }.join(', ')}"
        first_missing = missing.first
        redirect_to form_questionnaire_step_path(@form, first_missing[:key])
        return
      end

      @form.complete!
      redirect_to form_path(@form), notice: t("flash.form_completed")
    end

    private

    def set_form
      @form = current_user.forms.find(params[:form_id])
    end

    def missing_dimensions
      responded_keys = @form.form_responses.core.pluck(:indicator_key)
      QuestionnaireConfig.dimensions.select do |dim|
        dim_indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == dim[:key] }
        dim_indicators.any? { |i| !responded_keys.include?(i[:key]) }
      end
    end
  end
end
