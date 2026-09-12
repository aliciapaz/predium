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
        prune_out_of_chain!(form)
        apply_responses!(form)
      end
      Result.new(status: :ok, form: form)
    rescue ActiveRecord::RecordInvalid => e
      Result.new(status: :invalid, errors: e.record.errors.to_hash(true))
    end

    # A territory change leaves indicator rows that the new chain no longer
    # allows; drop them so the reload cannot resurrect them into the client.
    # Principles (and the new chain's keys) are always allowed.
    def prune_out_of_chain!(form)
      allowed = QuestionnaireConfig.known_indicator_keys(form.territory_key)
      form.form_responses.where.not(indicator_key: allowed).destroy_all
    end

    def apply_responses!(form)
      responses.each do |key, value|
        form.form_responses.find_or_initialize_by(indicator_key: key).tap do |response|
          response.value = value
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
      # Require the same key SET, not just that sent keys match: a payload that
      # drops a key (e.g. the client pruned a removed indicator) must count as a
      # change so apply -> prune_out_of_chain! runs instead of short-circuiting.
      return false unless current.keys.map(&:to_s).sort == responses.keys.map(&:to_s).sort

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
      responses.keys - allowed_keys(form)
    end

    # Allow-list is built from the INCOMING territory (the payload's value when it
    # carries one, else the stored value), so a push that switches territory and
    # sends the new keys together is accepted rather than rejected on the stale one.
    def allowed_keys(form)
      QuestionnaireConfig.known_indicator_keys(target_territory(form))
    end

    # ActionController::Parameters has indifferent access, so the symbol form
    # covers a string-keyed payload. Fall back to the stored territory only when
    # the payload does not carry the key at all.
    def target_territory(form)
      attributes.key?(:territory_key) ? attributes[:territory_key] : form.territory_key
    end

    def invalid_keys(keys)
      Result.new(status: :invalid, errors: keys.index_with { [I18n.t("errors.messages.not_in_questionnaire")] })
    end
  end
end
