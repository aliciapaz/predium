# frozen_string_literal: true

module Forms
  # Applies one offline sync payload to a form, enforcing the ADR-3 conflict
  # matrix: completed forms are authoritative server-side, stale drafts require
  # an explicit force flag, discarded forms tell the client to drop its copy.
  class SyncUpsert
    Result = Struct.new(:status, :form, :errors, keyword_init: true)

    attr_reader :user, :client_id, :attributes, :responses, :base_updated_at, :force

    def initialize(user:, client_id:, attributes:, responses:, base_updated_at: nil, force: false)
      @user = user
      @client_id = client_id
      @attributes = attributes
      @responses = responses.to_h.transform_keys(&:to_s)
      @base_updated_at = base_updated_at
      @force = force
    end

    def call
      form = Form.unscoped.where(user: user).find_by(client_id: client_id)

      return Result.new(status: :deleted) if form&.discarded?
      return create(form) if form.nil?
      return Result.new(status: :ok, form: form) if unchanged?(form)
      return Result.new(status: :conflict, form: form) if form.completed?
      return Result.new(status: :conflict, form: form) if stale?(form) && !force

      unknown = unknown_indicator_keys(form)
      return invalid_keys(unknown) if unknown.any?

      apply(form)
    end

    private

    def create(_form)
      form = user.forms.new(attributes.merge(client_id: client_id))
      unknown = unknown_indicator_keys(form)
      return invalid_keys(unknown) if unknown.any?

      apply(form)
    end

    def apply(form)
      ActiveRecord::Base.transaction do
        form.assign_attributes(attributes)
        form.synchronized_at = Time.current
        form.save!
        apply_responses!(form)
      end
      Result.new(status: :ok, form: form)
    rescue ActiveRecord::RecordInvalid => e
      Result.new(status: :invalid, errors: e.record.errors.to_hash(true))
    end

    def apply_responses!(form)
      responses.each do |key, value|
        form.form_responses.find_or_initialize_by(indicator_key: key).tap do |response|
          response.value = value
          response.is_extension = !QuestionnaireConfig.core_indicator?(key)
          response.save!
        end
      end
    end

    def unchanged?(form)
      form.assign_attributes(attributes)
      clean = !form.changed?
      form.restore_attributes
      clean && responses_match?(form)
    end

    def responses_match?(form)
      current = form.form_responses.each_with_object({}) { |r, map| map[r.indicator_key] = r.value }
      responses.all? { |key, value| current[key] == value.to_i }
    end

    def stale?(form)
      return true if base_updated_at.blank?

      to_ms(Time.iso8601(base_updated_at.to_s)) < to_ms(form.updated_at)
    rescue ArgumentError
      true
    end

    # Truncate to whole milliseconds so a base_updated_at echoed back from the
    # serializer's iso8601(3) compares equal to the stored microsecond value.
    def to_ms(time)
      (time.to_r * 1000).floor
    end

    def unknown_indicator_keys(form)
      allowed = QuestionnaireConfig.core_indicators.map { |i| i[:key] }
      if form.territory_key.present?
        allowed += QuestionnaireConfig.extension(form.territory_key)[:indicators].map { |i| i[:key] }
      end
      responses.keys - allowed
    end

    def invalid_keys(keys)
      Result.new(status: :invalid, errors: keys.index_with { [I18n.t("errors.messages.not_in_questionnaire")] })
    end
  end
end
