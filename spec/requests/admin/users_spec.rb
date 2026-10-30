# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Admin::Users", type: :request) do
  let(:admin) { create(:user, :super_admin) }
  let(:user) { create(:user) }

  before { sign_in admin }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /admin/users" do
    it "names the page once, in the heading, and in the browser tab" do
      get admin_users_path

      expect(page.css("header.app-bar").text).not_to(include("Usuarios"))
      expect(page.css("h1").map { |heading| heading.text.strip }).to(include("Usuarios"))
      expect(page.at("title").text).to(start_with("Usuarios"))
    end

    it "shows an org admin's organization role next to the platform role" do
      organization = create(:organization, name: "Cooperativa Sur")
      org_admin = create(:user, first_name: "Ana", last_name: "Pérez")
      create(:membership, :admin, user: org_admin, organization: organization)

      get admin_users_path

      row = page.css("table tbody tr").find { |candidate| candidate.text.include?("Ana Pérez") }
      roles = row.css(".badge-neutral, .badge-success").map { |badge| badge.text.strip }
      expect(roles).to(eq(["Usuario estándar", "Administrador en Cooperativa Sur"]))
    end
  end

  describe "GET /admin/users/:id" do
    it "shows the platform and organization roles in Spanish" do
      create(:membership, :admin, user: user, organization: create(:organization, name: "Cooperativa Sur"))

      get admin_user_path(user)

      expect(page.at(".page-header").text).to(include("Usuario estándar"))
      expect(page.at("main ul").text).to(include("Administrador"))
    end
  end

  describe "PATCH /admin/users/:id" do
    it "updates the platform role with a translated flash" do
      patch admin_user_path(user), params: { user: { platform_role: "super_admin" } }

      expect(user.reload).to(be_super_admin)
      expect(flash[:notice]).to(eq(I18n.t("flash.user_role_updated")))
    end
  end
end
