# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Admin::Forms", type: :request) do
  let(:admin) { create(:user, :super_admin) }
  let(:form) { create(:form, :completed, name: "Los Andes") }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /admin/forms/:id" do
    it "renders the form's results inside the admin layout" do
      create(:form_response, form: form, indicator_key: "biodiversity", value: 7)
      sign_in admin
      get admin_form_path(form)

      expect(response).to(have_http_status(:ok))
      expect(page.at("body")["data-controller"]).to(eq("admin-sidebar"))
      embedded = JSON.parse(page.at("[data-controller=results]")["data-results-form-value"])
      expect(embedded).to(include("client_id" => form.client_id, "name" => "Los Andes"))
      expect(embedded["responses"].pluck("indicator_key")).to(eq(["biodiversity"]))
    end

    it "links back to the admin page it was opened from" do
      referer = "http://www.example.com#{admin_user_path(form.user)}"
      sign_in admin
      get admin_form_path(form), headers: { "Referer" => referer }

      expect(page.at("a.back-link")["href"]).to(eq(referer))
    end

    it "links back to the dashboard without a referring page" do
      sign_in admin
      get admin_form_path(form)

      expect(page.at("a.back-link")["href"]).to(eq(admin_root_path))
    end

    it "keeps regular users out" do
      sign_in create(:user)
      get admin_form_path(form)

      expect(response).to(redirect_to(root_path))
    end
  end

  describe "form links on admin pages" do
    before { sign_in admin }

    it "opens dashboard activity in the admin area" do
      form
      get admin_root_path

      expect(page.at("table tbody a")["href"]).to(eq(admin_form_path(form)))
    end

    it "opens a user's recent forms in the admin area" do
      get admin_user_path(form.user)

      expect(page.at("table tbody a")["href"]).to(eq(admin_form_path(form)))
    end

    it "opens an organization's recent forms in the admin area" do
      organization = create(:organization)
      create(:membership, user: form.user, organization: organization)
      get admin_organization_path(organization)

      expect(page.css("table tbody a").pluck("href")).to(include(admin_form_path(form)))
    end
  end
end
