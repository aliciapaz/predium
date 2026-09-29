# frozen_string_literal: true

FactoryBot.define do
  factory :form do
    user
    name { "Test Farm" }
    country { "CL" }
    territory_key { "chile" }

    trait :completed do
      state { "completed" }
      completed_at { Time.current }
    end

    trait :completed_with_responses do
      completed
      after(:create) do |form|
        QuestionnaireConfig.principle_keys.each do |key|
          create(:form_response, form: form, indicator_key: key, value: rand(1..10))
        end
        QuestionnaireConfig.extension_indicator_keys(form.territory_key).each do |key|
          create(:form_response, form: form, indicator_key: key, value: rand(1..10))
        end
      end
    end

    trait :discarded do
      discarded_at { Time.current }
    end
  end
end
