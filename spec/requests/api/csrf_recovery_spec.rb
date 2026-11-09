# frozen_string_literal: true

require "rails_helper"

RSpec.describe("API CSRF recovery", type: :request) do
  around do |example|
    ActionController::Base.allow_forgery_protection = true
    example.run
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  def push(token)
    put(
      "/api/forms/csrf-form",
      params: { form: { name: "Sync Farm" }, responses: {} },
      headers: { "X-CSRF-Token" => token },
      as: :json,
    )
  end

  it "answers a push carrying a stale token with a fresh one the client can retry with" do
    sign_in create(:user)

    push("token-from-a-lost-session")

    expect(response).to(have_http_status(:forbidden))
    expect(response.parsed_body["error"]).to(eq("invalid_csrf_token"))

    push(response.parsed_body["csrf_token"])

    expect(response).to(have_http_status(:ok))
  end
end
