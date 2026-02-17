# Seed data for development and QA testing.
# Run with: bin/rails db:seed
# Idempotent — safe to run multiple times.

puts "Seeding..."

# --- Super Admin ---
admin = User.find_or_initialize_by(email: "admin@predium.cl")
admin.assign_attributes(
  first_name: "Admin",
  last_name: "Predium",
  password: "password",
  platform_role: :super_admin,
  locale: "en",
  confirmed_at: Time.current
)
admin.save!
puts "  Super admin: admin@predium.cl / password"

# --- Organizations ---
org_tierra = Organization.find_or_create_by!(name: "Tierra Viva")
org_semilla = Organization.find_or_create_by!(name: "Red Semilla")
puts "  Organizations: Tierra Viva, Red Semilla"

# --- Org Admin ---
org_admin = User.find_or_initialize_by(email: "orgadmin@predium.cl")
org_admin.assign_attributes(
  first_name: "María",
  last_name: "González",
  password: "password",
  platform_role: :regular,
  locale: "es",
  confirmed_at: Time.current
)
org_admin.save!
Membership.find_or_create_by!(user: org_admin, organization: org_tierra) do |m|
  m.role = :admin
end
puts "  Org admin (Tierra Viva): orgadmin@predium.cl / password"

# --- Org Member ---
member = User.find_or_initialize_by(email: "member@predium.cl")
member.assign_attributes(
  first_name: "Juan",
  last_name: "Pérez",
  password: "password",
  platform_role: :regular,
  locale: "es",
  confirmed_at: Time.current
)
member.save!
Membership.find_or_create_by!(user: member, organization: org_tierra) do |m|
  m.role = :member
end
puts "  Org member (Tierra Viva): member@predium.cl / password"

# --- Independent User (no org) ---
indie = User.find_or_initialize_by(email: "user@predium.cl")
indie.assign_attributes(
  first_name: "Ana",
  last_name: "Silva",
  password: "password",
  platform_role: :regular,
  locale: "en",
  confirmed_at: Time.current
)
indie.save!
puts "  Independent user: user@predium.cl / password"

# --- Second Org Member (for Red Semilla) ---
member2 = User.find_or_initialize_by(email: "member2@predium.cl")
member2.assign_attributes(
  first_name: "Carlos",
  last_name: "Rojas",
  password: "password",
  platform_role: :regular,
  locale: "es",
  confirmed_at: Time.current
)
member2.save!
Membership.find_or_create_by!(user: member2, organization: org_semilla) do |m|
  m.role = :admin
end
puts "  Org admin (Red Semilla): member2@predium.cl / password"

# --- Profiles ---
[admin, org_admin, member, indie, member2].each do |user|
  Profile.find_or_create_by!(user: user) do |p|
    p.phone = "+56 9 #{rand(1000_0000..9999_9999)}"
    p.role_name = %w[Farmer Researcher Extension\ Agent Agronomist].sample
    p.country = "CL"
    p.region = %w[Valparaíso Biobío Araucanía Maule].sample
    p.locality = %w[Limache Chillán Temuco Talca].sample
  end
end
puts "  Profiles created for all users"

# --- Sample Forms ---
indicators = QuestionnaireConfig.core_indicators

# Completed form for org_admin
completed_form = org_admin.forms.find_or_initialize_by(name: "Fundo El Roble")
completed_form.assign_attributes(
  country: "CL", region: "Biobío", locality: "Chillán",
  land_area: 12.5, latitude: -36.6066, longitude: -72.1034,
  work_force: 3, state: "completed", completed_at: 2.days.ago
)
completed_form.save!
indicators.each do |ind|
  FormResponse.find_or_create_by!(form: completed_form, indicator_key: ind[:key]) do |r|
    r.value = rand(3..9)
    r.is_extension = false
  end
end
puts "  Completed form: Fundo El Roble (org_admin)"

# Another completed form for member
completed_form2 = member.forms.find_or_initialize_by(name: "Huerta La Esperanza")
completed_form2.assign_attributes(
  country: "CL", region: "Araucanía", locality: "Temuco",
  land_area: 5.0, latitude: -38.7359, longitude: -72.5904,
  work_force: 2, state: "completed", completed_at: 1.week.ago
)
completed_form2.save!
indicators.each do |ind|
  FormResponse.find_or_create_by!(form: completed_form2, indicator_key: ind[:key]) do |r|
    r.value = rand(1..7)
    r.is_extension = false
  end
end
puts "  Completed form: Huerta La Esperanza (member)"

# Draft form for member
draft_form = member.forms.find_or_initialize_by(name: "Campo Nuevo")
draft_form.assign_attributes(
  country: "CL", region: "Maule", locality: "Talca",
  land_area: 8.0, state: "draft"
)
draft_form.save!
# Partially filled — only first 20 indicators
indicators.first(20).each do |ind|
  FormResponse.find_or_create_by!(form: draft_form, indicator_key: ind[:key]) do |r|
    r.value = rand(1..10)
    r.is_extension = false
  end
end
puts "  Draft form (partial): Campo Nuevo (member)"

# Draft form for indie user
draft_indie = indie.forms.find_or_initialize_by(name: "Parcela Sol")
draft_indie.assign_attributes(
  country: "CL", region: "Valparaíso", locality: "Limache",
  state: "draft"
)
draft_indie.save!
puts "  Draft form (empty): Parcela Sol (indie user)"

# Completed form for indie user
completed_indie = indie.forms.find_or_initialize_by(name: "Quinta Verde")
completed_indie.assign_attributes(
  country: "CL", region: "Valparaíso", locality: "Quillota",
  land_area: 3.2, latitude: -32.8801, longitude: -71.2514,
  work_force: 1, state: "completed", completed_at: 3.days.ago
)
completed_indie.save!
indicators.each do |ind|
  FormResponse.find_or_create_by!(form: completed_indie, indicator_key: ind[:key]) do |r|
    r.value = rand(4..10)
    r.is_extension = false
  end
end
puts "  Completed form: Quinta Verde (indie user)"

puts ""
puts "Done! Seed accounts:"
puts "  admin@predium.cl     / password  (super admin)"
puts "  orgadmin@predium.cl  / password  (org admin - Tierra Viva)"
puts "  member@predium.cl    / password  (org member - Tierra Viva)"
puts "  member2@predium.cl   / password  (org admin - Red Semilla)"
puts "  user@predium.cl      / password  (independent user)"
