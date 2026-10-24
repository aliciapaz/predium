# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Locale precedence", type: :request) do
  describe "GET /users/sign_in" do
    it "uses Spanish even when the browser prefers English" do
      get new_user_session_path, headers: { "Accept-Language" => "en-US,en;q=0.9" }

      expect(response.body).to(include('<html lang="es">', "Iniciar sesión"))
    end

    it "honors an explicit supported locale" do
      get new_user_session_path(locale: "en"), headers: { "Accept-Language" => "es" }

      expect(response.body).to(include('<html lang="en">', "Sign in"))
    end

    it "uses Spanish when the explicit locale is unsupported" do
      get new_user_session_path(locale: "fr"), headers: { "Accept-Language" => "en" }

      expect(response.body).to(include('<html lang="es">'))
    end
  end

  describe "GET / with a ?locale param" do
    context "when the signed-in user has a stored locale" do
      let(:user) { create(:user, locale: "es") }

      before { sign_in user }

      it "lets an explicit ?locale param override the stored preference" do
        get root_path(locale: "en")

        expect(response.body).to(include("Drafts"))
        expect(response.body).not_to(include("Borradores"))
      end

      it "falls back to the stored preference when no param is given" do
        get root_path

        expect(response.body).to(include("Borradores"))
      end
    end

    context "when the signed-in user prefers English" do
      let(:user) { create(:user, locale: "en") }

      before { sign_in user }

      it "honors the stored preference over the default and browser language" do
        get root_path, headers: { "Accept-Language" => "es" }

        expect(response.body).to(include("Drafts"))
      end
    end
  end
end
