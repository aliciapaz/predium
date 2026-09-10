# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { "Organization #{SecureRandom.hex(4)}" }
  end
end
