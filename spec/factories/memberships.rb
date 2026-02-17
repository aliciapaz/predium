FactoryBot.define do
  factory :membership do
    user
    organization
    role { :member }

    trait :admin do
      role { :admin }
    end
  end
end
