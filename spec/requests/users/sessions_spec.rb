# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Sign-in errors", type: :request) do
  it "explains a failed sign-in in plain words" do
    user = create(:user)

    post user_session_path, params: { user: { email: user.email, password: "wrong-password" } }

    expect(response.body).to(include("El correo o la contraseña no son correctos. Revísalos e intenta de nuevo."))
  end

  it "uses the plain English copy over Devise's stock file" do
    expect(I18n.t("devise.failure.unauthenticated", locale: :en)).to(eq("Sign in to continue."))
  end
end
