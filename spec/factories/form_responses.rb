FactoryBot.define do
  factory :form_response do
    form
    indicator_key { "soil_coverage" }
    value { 5 }
    is_extension { false }
  end
end
