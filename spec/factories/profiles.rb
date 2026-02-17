FactoryBot.define do
  factory :profile do
    user
    phone { "+56912345678" }
    role_name { "Farmer" }
    country { "CL" }
    region { "Valparaiso" }
    locality { "Quillota" }
  end
end
