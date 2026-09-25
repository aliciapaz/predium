# frozen_string_literal: true

module Forms
  class CompletionsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_form

    def create
      return redirect_to(form_path(@form)) if @form.completed?

      missing = @form.missing_sections
      if missing.any?
        flash[:alert] = t("flash.missing_indicators", dimensions: missing.map { |key| t(key) }.join(", "))
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
  end
end
