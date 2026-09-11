# frozen_string_literal: true

module Api
  class FormsController < Api::BaseController
    def index
      forms = current_user.forms.with_responses.recently_updated
      render(json: { forms: forms.map { |form| serialize_form(form) } })
    end

    def show
      form = current_user.forms.find_by(client_id: params[:client_id])
      return render(json: { error: "not_found" }, status: :not_found) unless form

      render(json: { form: serialize_form(form) })
    end

    def update
      invalid = unknown_indicator_errors
      return render(json: { errors: invalid }, status: :unprocessable_entity) if invalid

      render_result(sync_upsert)
    end

    private

    def unknown_indicator_errors
      unknown = params.fetch(:responses, {}).keys - known_indicator_keys
      return if unknown.empty?

      unknown.index_with { [I18n.t("errors.messages.not_in_questionnaire")] }
    end

    def sync_upsert
      Forms::SyncUpsert.new(
        user: current_user,
        client_id: params[:client_id],
        attributes: form_params,
        responses: responses_params,
        base_updated_at: params[:base_updated_at],
        force: ActiveModel::Type::Boolean.new.cast(params[:force]),
      ).call
    end

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
        responses: serialize_responses(form),
      )
    end

    def serialize_responses(form)
      form.form_responses.map do |response|
        { indicator_key: response.indicator_key, value: response.value, is_extension: response.is_extension }
      end
    end
  end
end
