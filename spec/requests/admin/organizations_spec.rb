# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Admin organizations", type: :request) do
  let(:organization) { create(:organization) }

  describe "GET /admin/organizations/:id" do
    it "links to the organization's members page, where invitations live" do
      sign_in create(:user, :super_admin)
      get admin_organization_path(organization)

      links = Nokogiri::HTML(response.body).css("a").pluck("href")
      expect(links).to(include(organization_memberships_path(organization)))
    end
  end
end
