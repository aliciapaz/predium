# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Account settings", type: :request) do
  let(:user) { create(:user, first_name: "Ana", last_name: "Pérez", email: "ana@example.com") }

  before { sign_in user }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /account/edit" do
    it "leads back to the profile" do
      get edit_account_path

      expect(page.at("a.back-link")["href"]).to(eq(profile_path))
    end

    it "is linked from the profile" do
      get profile_path

      expect(page.css("a").map { |link| link["href"] }).to(include(edit_account_path))
    end
  end

  describe "PATCH /account" do
    it "changes the name" do
      patch account_path, params: { user: { first_name: "Analía", last_name: "Soto" } }

      expect(response).to(redirect_to(edit_account_path))
      expect(user.reload.first_name).to(eq("Analía"))
      expect(user.last_name).to(eq("Soto"))
    end

    it "says under the field when the name is missing" do
      patch account_path, params: { user: { first_name: "", last_name: "Soto" } }

      expect(response).to(have_http_status(:unprocessable_content))
      expect(page.at("#name_user_first_name + p.field-error").text).to(eq("Escribe tu nombre."))
      expect(user.reload.first_name).to(eq("Ana"))
    end
  end

  describe "PATCH /account/password" do
    it "changes the password and keeps the user signed in" do
      patch account_password_path, params: {
        user: { current_password: "password123", password: "nueva-clave-9", password_confirmation: "nueva-clave-9" },
      }

      expect(response).to(redirect_to(edit_account_path))
      expect(user.reload.valid_password?("nueva-clave-9")).to(be(true))

      get profile_path
      expect(response).to(have_http_status(:ok))
    end

    it "refuses a wrong current password" do
      patch account_password_path, params: {
        user: { current_password: "wrong", password: "nueva-clave-9", password_confirmation: "nueva-clave-9" },
      }

      expect(response).to(have_http_status(:unprocessable_content))
      expect(page.at("#password_user_current_password + p.field-error").text).to(eq("La contraseña actual no es correcta."))
      expect(page.at("#email_user_current_password + p.field-error")).to(be_nil)
      expect(user.reload.valid_password?("password123")).to(be(true))
    end

    it "refuses an empty new password" do
      patch account_password_path, params: {
        user: { current_password: "password123", password: "", password_confirmation: "" },
      }

      expect(response).to(have_http_status(:unprocessable_content))
      expect(page.at("#password_user_password + p.field-error").text).to(eq("Escribe una contraseña."))
    end
  end

  describe "PATCH /account/email" do
    it "asks the user to confirm the new address before switching to it" do
      expect do
        patch(account_email_path, params: { user: { email: "ana.nueva@example.com", current_password: "password123" } })
      end.to(change { ActionMailer::Base.deliveries.size }.by(1))

      expect(response).to(redirect_to(edit_account_path))
      expect(user.reload.email).to(eq("ana@example.com"))
      expect(user.unconfirmed_email).to(eq("ana.nueva@example.com"))
      expect(ActionMailer::Base.deliveries.last.to).to(eq(["ana.nueva@example.com"]))
    end

    it "refuses a wrong current password" do
      patch account_email_path, params: { user: { email: "ana.nueva@example.com", current_password: "wrong" } }

      expect(response).to(have_http_status(:unprocessable_content))
      expect(page.at("#email_user_current_password + p.field-error").text).to(eq("La contraseña actual no es correcta."))
      expect(user.reload.unconfirmed_email).to(be_nil)
    end
  end
end
