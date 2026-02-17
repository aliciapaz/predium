# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_14_161822) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "form_responses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "form_id", null: false
    t.string "indicator_key", null: false
    t.boolean "is_extension", default: false
    t.datetime "updated_at", null: false
    t.integer "value", null: false
    t.index ["form_id", "indicator_key"], name: "index_form_responses_on_form_id_and_indicator_key", unique: true
    t.index ["form_id"], name: "index_form_responses_on_form_id"
    t.index ["indicator_key"], name: "index_form_responses_on_indicator_key"
    t.index ["is_extension"], name: "index_form_responses_on_is_extension"
  end

  create_table "forms", force: :cascade do |t|
    t.datetime "completed_at"
    t.string "country"
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.datetime "discarded_at"
    t.integer "gender"
    t.decimal "land_area", precision: 10, scale: 2
    t.decimal "latitude", precision: 10, scale: 6
    t.string "locality"
    t.decimal "longitude", precision: 10, scale: 6
    t.string "name", null: false
    t.string "national_id"
    t.text "observations"
    t.string "phone"
    t.string "region"
    t.string "state", default: "draft"
    t.datetime "synchronized_at"
    t.text "system_types", default: [], array: true
    t.string "territory_key"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "work_force"
    t.index ["completed_at"], name: "index_forms_on_completed_at"
    t.index ["country", "region"], name: "index_forms_on_country_and_region"
    t.index ["discarded_at"], name: "index_forms_on_discarded_at"
    t.index ["state"], name: "index_forms_on_state"
    t.index ["territory_key"], name: "index_forms_on_territory_key"
    t.index ["user_id"], name: "index_forms_on_user_id"
  end

  create_table "memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "organization_id", null: false
    t.integer "role", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["organization_id"], name: "index_memberships_on_organization_id"
    t.index ["role"], name: "index_memberships_on_role"
    t.index ["user_id", "organization_id"], name: "index_memberships_on_user_id_and_organization_id", unique: true
    t.index ["user_id"], name: "index_memberships_on_user_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_organizations_on_name", unique: true
  end

  create_table "profiles", force: :cascade do |t|
    t.string "country"
    t.datetime "created_at", null: false
    t.string "locality"
    t.string "phone"
    t.string "region"
    t.string "role_name"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_profiles_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "confirmation_sent_at"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "encrypted_password", null: false
    t.string "first_name", null: false
    t.datetime "invitation_accepted_at"
    t.datetime "invitation_created_at"
    t.integer "invitation_limit"
    t.datetime "invitation_sent_at"
    t.string "invitation_token"
    t.integer "invitations_count", default: 0
    t.bigint "invited_by_id"
    t.string "invited_by_type"
    t.string "last_name", null: false
    t.string "locale", default: "en"
    t.integer "platform_role", default: 0
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.string "unconfirmed_email"
    t.datetime "updated_at", null: false
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["invitation_token"], name: "index_users_on_invitation_token", unique: true
    t.index ["platform_role"], name: "index_users_on_platform_role"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "form_responses", "forms"
  add_foreign_key "forms", "users"
  add_foreign_key "memberships", "organizations"
  add_foreign_key "memberships", "users"
  add_foreign_key "profiles", "users"
end
