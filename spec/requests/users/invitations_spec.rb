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

  describe "accepting an invitation" do
    let(:invitee) do
      User.invite!(email: "nuevo@example.com", **User::PLACEHOLDER_NAME) { |user| user.skip_invitation = true }
    end

    def accept(first_name:, last_name:)
      put(user_invitation_path, params: {
        user: {
          invitation_token: invitee.raw_invitation_token,
          first_name: first_name,
          last_name: last_name,
          password: "password123",
          password_confirmation: "password123",
        },
      })
    end

    it "asks for a name instead of showing the placeholder" do
      get accept_user_invitation_path(invitation_token: invitee.raw_invitation_token)

      page = Nokogiri::HTML(response.body)

      expect(page.at_css('input[name="user[first_name]"]')["value"]).to(be_blank)
      expect(page.at_css('input[name="user[last_name]"]')["value"]).to(be_blank)
    end

    it "keeps a name the inviter already gave" do
      named = User.invite!(email: "ana@example.com", first_name: "Ana", last_name: "Rojas") do |user|
        user.skip_invitation = true
      end

      get accept_user_invitation_path(invitation_token: named.raw_invitation_token)

      expect(Nokogiri::HTML(response.body).at_css('input[name="user[first_name]"]')["value"]).to(eq("Ana"))
    end

    it "saves the name the invitee enters" do
      accept(first_name: "María", last_name: "González")

      expect(invitee.reload).to(have_attributes(first_name: "María", last_name: "González"))
      expect(invitee).to(be_invitation_accepted)
    end

    it "does not accept the invitation without a name" do
      accept(first_name: "", last_name: "")

      expect(invitee.reload).not_to(be_invitation_accepted)
      expect(response).to(have_http_status(:unprocessable_content))
    end
  end
end
