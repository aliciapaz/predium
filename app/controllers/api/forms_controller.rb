# frozen_string_literal: true

module Api
  class FormsController < Api::BaseController
    def index
      forms = current_user.forms.includes(:form_responses).order(updated_at: :desc)
      render(json: { forms: forms.map { |form| serialize_form(form) } })
    end

    def update
      unknown = params.fetch(:responses, {}).keys - known_indicator_keys
      if unknown.any?
        errors = unknown.index_with { [I18n.t("errors.messages.not_in_questionnaire")] }
        return render(json: { errors: errors }, status: :unprocessable_entity)
      end

      result = Forms::SyncUpsert.new(
        user: current_user,
        client_id: params[:client_id],
        attributes: form_params,
        responses: responses_params,
        base_updated_at: params[:base_updated_at],
        force: ActiveModel::Type::Boolean.new.cast(params[:force]),
      ).call

      render_result(result)
    end

    private

    def render_result(result)
      case result.status
      when :ok
        render(json: { form: serialize_form(result.form.reload) })
      when :deleted
        render(json: { deleted: true, client_id: params[:client_id] })
      when :conflict
        render(json: { conflict: conflict_payload(result.form) }, status: :conflict)
      when :invalid
        render(json: { errors: result.errors }, status: :unprocessable_entity)
      end
    end

    def conflict_payload(form)
      { reason: form.completed? ? "completed" : "stale", form: serialize_form(form) }
    end

    FARM_FIELDS = [
      :name,
      :national_id,
      :date_of_birth,
      :phone,
      :gender,
      :work_force,
      :land_area,
      :latitude,
      :longitude,
      :country,
      :region,
      :locality,
      :observations,
      :territory_key,
    ].freeze

    def form_params
      params.expect(form: [*FARM_FIELDS, system_types: []])
    end

    def responses_params
      params.fetch(:responses, {}).permit(*known_indicator_keys).to_h
    end

    def known_indicator_keys
      @known_indicator_keys ||= QuestionnaireConfig.core_indicators.map { |i| i[:key] } +
        QuestionnaireConfig.extension_keys.flat_map do |key|
          QuestionnaireConfig.extension(key)[:indicators].map { |i| i[:key] }
        end
    end

    def serialize_form(form)
      FARM_FIELDS.index_with { |field| form.public_send(field) }.merge(
        client_id: form.client_id,
        state: form.state,
        system_types: form.system_types,
        completed_at: form.completed_at&.iso8601(3),
        synchronized_at: form.synchronized_at&.iso8601(3),
        updated_at: form.updated_at.iso8601(3),
        responses: form.form_responses.map do |response|
          { indicator_key: response.indicator_key, value: response.value, is_extension: response.is_extension }
        end,
      )
    end
  end
end
