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

RSpec.describe("Staying signed in", type: :request) do
  include ActiveSupport::Testing::TimeHelpers

  it "ticks remember me by default" do
    get new_user_session_path

    checkbox = Nokogiri::HTML(response.body).at_css('input[type="checkbox"][name="user[remember_me]"]')

    expect(checkbox["checked"]).to(be_present)
  end

  it "keeps remember me unticked when a sign-in that opted out fails" do
    user = create(:user)

    post user_session_path, params: { user: { email: user.email, password: "wrong-password", remember_me: "0" } }

    checkbox = Nokogiri::HTML(response.body).at_css('input[type="checkbox"][name="user[remember_me]"]')
    expect(checkbox["checked"]).to(be_blank)
  end

  it "keeps a remembered user signed in for 90 days" do
    user = create(:user)

    post user_session_path, params: { user: { email: user.email, password: user.password, remember_me: "1" } }

    expect(remember_cookie_expiry).to(be_within(1.minute).of(90.days.from_now))
  end

  it "restarts the 90 days each time the app reopens from the remember cookie" do
    user = create(:user)
    post user_session_path, params: { user: { email: user.email, password: user.password, remember_me: "1" } }

    travel 60.days do
      cookies.delete("_predium_session")
      get root_path

      expect(response).to(have_http_status(:ok))
      expect(remember_cookie_expiry).to(be_within(1.minute).of(90.days.from_now))
    end
  end

  it "stops honouring the remember cookie after sign-out" do
    user = create(:user)
    post user_session_path, params: { user: { email: user.email, password: user.password, remember_me: "1" } }
    remember_token = cookies["remember_user_token"]

    delete destroy_user_session_path
    cookies.delete("_predium_session")
    cookies["remember_user_token"] = remember_token
    get root_path

    expect(response).to(redirect_to(new_user_session_path))
  end

  def remember_cookie_expiry
    remember_cookie = Array(response.headers["Set-Cookie"]).find { |c| c.start_with?("remember_user_token=") }
    Time.zone.parse(remember_cookie[/expires=([^;]+)/, 1])
  end
end
