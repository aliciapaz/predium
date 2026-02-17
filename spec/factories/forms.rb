FactoryBot.define do
  factory :form do
    user
    name { "Test Farm" }
    country { "CL" }

    trait :completed do
      state { "completed" }
      completed_at { Time.current }
    end

    trait :completed_with_responses do
      completed
      after(:create) do |form|
        QuestionnaireConfig.core_indicators.each do |indicator|
          create(:form_response, form: form, indicator_key: indicator[:key], value: rand(1..10))
        end
      end
    end

    trait :discarded do
      discarded_at { Time.current }
    end
  end
end
