module Forms
  class QuestionnaireStepsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_form
    before_action :set_dimension

    def show
      @indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == @dimension[:key] }
      @responses = @form.form_responses.where(indicator_key: @indicators.map { |i| i[:key] }).index_by(&:indicator_key)
      @all_dimensions = QuestionnaireConfig.dimensions
      @dimension_completion = dimension_completion_map
      @total_indicators = QuestionnaireConfig.core_indicators.size
      @scored_indicators = @form.form_responses.core.count
    end

    def update
      ActiveRecord::Base.transaction do
        responses_params.each do |indicator_key, value|
          next if value.blank?

          @form.form_responses.find_or_initialize_by(indicator_key: indicator_key).tap do |response|
            response.value = value
            response.is_extension = false
            response.save!
          end
        end
      end

      if next_dimension
        redirect_to form_questionnaire_step_path(@form, next_dimension[:key])
      else
        redirect_to form_path(@form), notice: t("flash.form_updated")
      end
    rescue ActiveRecord::RecordInvalid => e
      flash.now[:alert] = e.message
      @indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == @dimension[:key] }
      @responses = @form.form_responses.where(indicator_key: @indicators.map { |i| i[:key] }).index_by(&:indicator_key)
      @all_dimensions = QuestionnaireConfig.dimensions
      @dimension_completion = dimension_completion_map
      @total_indicators = QuestionnaireConfig.core_indicators.size
      @scored_indicators = @form.form_responses.core.count
      render :show, status: :unprocessable_entity
    end

    private

    def set_form
      @form = current_user.forms.find(params[:form_id])
    end

    def set_dimension
      @dimension = QuestionnaireConfig.dimensions.find { |d| d[:key] == params[:id] }
      raise ActiveRecord::RecordNotFound, "Unknown dimension: #{params[:id]}" unless @dimension

      @current_index = QuestionnaireConfig.dimensions.index(@dimension)
    end

    def responses_params
      params.fetch(:form_responses, {}).permit!
    end

    def next_dimension
      QuestionnaireConfig.dimensions[@current_index + 1]
    end

    def prev_dimension
      return nil if @current_index.zero?

      QuestionnaireConfig.dimensions[@current_index - 1]
    end
    helper_method :prev_dimension, :next_dimension

    def dimension_completion_map
      responded_keys = @form.form_responses.core.pluck(:indicator_key)
      QuestionnaireConfig.dimensions.each_with_object({}) do |dim, map|
        dim_indicators = QuestionnaireConfig.core_indicators.select { |i| i[:dimension] == dim[:key] }
        answered = dim_indicators.count { |i| responded_keys.include?(i[:key]) }
        map[dim[:key]] = { answered: answered, total: dim_indicators.size }
      end
    end
    helper_method :dimension_completion_map
  end
end
