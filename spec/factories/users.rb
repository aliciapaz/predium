FactoryBot.define do
  factory :user do
    email { "user#{SecureRandom.hex(4)}@example.com" }
    password { "password123" }
    first_name { "Test" }
    last_name { "User" }
    confirmed_at { Time.current }

    trait :super_admin do
      platform_role { :super_admin }
    end
  end
end
