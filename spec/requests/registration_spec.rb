# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Self sign-up", type: :request) do
  it "has no sign-up page" do
    get "/users/sign_up"

    expect(response).to(have_http_status(:not_found))
  end

  it "does not create an account from a sign-up submission" do
    params = { user: { email: "new@example.com", password: "password123", first_name: "A", last_name: "B" } }

    expect { post("/users", params: params) }.not_to(change(User, :count))
  end

  it "does not link to sign-up from the sign-in page" do
    get new_user_session_path

    expect(response.body).not_to(include("/users/sign_up"))
  end
end
