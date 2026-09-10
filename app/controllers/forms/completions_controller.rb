# frozen_string_literal: true

module Forms
  class CompletionsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_form

    def create
      return redirect_to(form_path(@form)) if @form.completed?

      missing = missing_dimensions
      if missing.any?
        flash[:alert] = t("flash.missing_indicators", dimensions: missing.map { |d| t(d[:i18n_key]) }.join(", "))
        redirect_to(edit_form_path(@form))
        return
      end

      @form.complete!
      redirect_to(form_path(@form), notice: t("flash.form_completed"))
    end

    private

    def set_form
      @form = current_user.forms.find_by!(client_id: params[:form_id])
    end

    def missing_dimensions
      responded_keys = @form.form_responses.core_indicator_keys
      QuestionnaireConfig.dimensions.select do |dim|
        dim_indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == dim[:key] }
        dim_indicators.any? { |i| !responded_keys.include?(i[:key]) }
      end
    end
  end
end
