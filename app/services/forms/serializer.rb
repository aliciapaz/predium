# frozen_string_literal: true

module Forms
  # The JSON shape the PWA reads a form in, shared by the sync API and the
  # results page that embeds a form the viewer does not own.
  class Serializer
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

    def initialize(form)
      @form = form
    end

    def call
      FARM_FIELDS.index_with { |field| form.public_send(field) }.merge(
        client_id: form.client_id,
        state: form.state,
        system_types: form.system_types,
        completed_at: form.completed_at&.iso8601(3),
        synchronized_at: form.synchronized_at&.iso8601(3),
        updated_at: form.updated_at.iso8601(3),
        responses: responses,
      )
    end

    private

    attr_reader :form

    def responses
      form.form_responses.map do |response|
        { indicator_key: response.indicator_key, value: response.value, is_extension: response.is_extension }
      end
    end
  end
end
