# frozen_string_literal: true

require "rails_helper"

RSpec.describe(Devise::Mailer) do
  let(:user) { create(:user) }

  around { |example| I18n.with_locale(:es) { example.run } }

  def html(mail) = (mail.html_part || mail).body.decoded

  it "sends password resets in Spanish from the Predium address" do
    mail = described_class.reset_password_instructions(user, "token")

    expect(mail.from).to(eq(["hola@prediumapp.org"]))
    expect(mail.subject).to(eq("Instrucciones para restablecer tu contraseña"))
    expect(html(mail)).to(include("Cambiar mi contraseña", "reset_password_token=token"))
  end

  it "sends confirmations in Spanish" do
    mail = described_class.confirmation_instructions(user, "token")

    expect(html(mail)).to(include("Confirmar mi cuenta", "confirmation_token=token"))
  end

  it "sends invitations from the Predium address" do
    user.invite! { |u| u.skip_invitation = true }
    mail = described_class.invitation_instructions(user, "token")

    expect(mail.from).to(eq(["hola@prediumapp.org"]))
    expect(html(mail)).to(include("Aceptar la invitación"))
  end
end
