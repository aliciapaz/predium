# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Users::Invitations", type: :request) do
  let(:params) { { user: { email: "peer@example.com", first_name: "Peer", last_name: "User" } } }

  describe "POST /users/invitation" do
    it "forbids regular users from creating accounts" do
      sign_in create(:user)

      expect { post(user_invitation_path, params: params) }.not_to(change(User, :count))
      expect(response).to(have_http_status(:forbidden))
    end

    it "lets super admins create accounts" do
      sign_in create(:user, :super_admin)

      expect { post(user_invitation_path, params: params) }.to(change(User, :count).by(1))
    end
  end
end
