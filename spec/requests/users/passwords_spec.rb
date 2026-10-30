# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Password reset errors", type: :request) do
  def page
    Nokogiri::HTML(response.body)
  end

  it "says under the email field when no account uses it" do
    post user_password_path, params: { user: { email: "nadie@example.com" } }

    expect(response).to(have_http_status(:unprocessable_content))
    expect(page.at("input[type=email]")["aria-invalid"]).to(eq("true"))
    expect(page.at("input[type=email] + p.field-error").text).to(eq("No encontramos una cuenta con este correo."))
  end

  it "says under each password field what to fix" do
    user = create(:user)
    token = user.send(:set_reset_password_token)

    put user_password_path, params: {
      user: { reset_password_token: token, password: "abc", password_confirmation: "xyz" },
    }

    errors = page.css("p.field-error").map(&:text)
    expect(errors).to(eq(["Usa al menos 6 caracteres.", "Las contraseñas no coinciden."]))
  end

  it "explains an invalid reset link at the top of the form" do
    put user_password_path, params: {
      user: { reset_password_token: "wrong", password: "password123", password_confirmation: "password123" },
    }

    expect(page.at("[role=alert]").text.strip).to(eq("El enlace para cambiar la contraseña no es válido. Pide uno nuevo."))
  end
end
