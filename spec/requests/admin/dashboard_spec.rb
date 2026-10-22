# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Admin area", type: :request) do
  let(:admin) { create(:user, :super_admin) }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /admin" do
    it "offers no CSV export until the feature exists" do
      sign_in admin
      get admin_root_path

      expect(response.body).not_to(include("Exportar CSV"))
    end

    it "marks the current sidebar link even when links carry a locale query" do
      sign_in create(:user, :super_admin, locale: "en")
      get admin_root_path

      current = page.css('aside a[aria-current="page"]').map { |link| link.text.strip }
      expect(current).to(eq(["Dashboard"]))
    end
  end

  describe "GET /admin/organizations" do
    it "counts the organizations" do
      first = create(:organization)
      create(:membership, organization: first)
      create(:membership, organization: first)
      create(:organization)
      sign_in admin
      get admin_organizations_path

      expect(page.at(".page-header .badge-neutral").text.strip).to(eq("2"))
    end

    it "prints creation dates with the Spanish format" do
      create(:organization, created_at: Time.zone.local(2026, 10, 22, 9))
      sign_in admin
      get admin_organizations_path

      expect(page.at("table tbody").text).to(include("22 oct 2026"))
    end
  end
end
