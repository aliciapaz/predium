# frozen_string_literal: true

FactoryBot.define do
  factory :form_response do
    form
    indicator_key { "biodiversity" } # a principle: valid on any territory
    value { 5 }
    # is_extension is derived by the model from the key; do not set it here.
  end
end
