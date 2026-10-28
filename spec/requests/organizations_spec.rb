# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Organizations", type: :request) do
  let(:organization) { create(:organization, name: "Cooperativa Sur") }
  let(:org_admin) { create(:user, first_name: "Ana", last_name: "Pérez") }
  let(:member) { create(:user, first_name: "Luis", last_name: "Soto") }

  before do
    create(:membership, :admin, user: org_admin, organization: organization)
    create(:membership, user: member, organization: organization)
  end

  def page
    Nokogiri::HTML(response.body)
  end

  def app_bar_links
    page.css("nav.app-bar a").map { |link| [link.text.strip, link["href"]] }
  end

  describe "app bar" do
    it "gives an org admin a path to the organization" do
      sign_in org_admin
      get forms_path

      expect(app_bar_links).to(include(["Organización", organization_forms_path(organization)]))
    end

    it "marks the organization entry current on the members page" do
      sign_in org_admin
      get organization_memberships_path(organization)

      current = page.css('nav.app-bar a[aria-current="page"]').map { |link| link.text.strip }
      expect(current).to(include("Organización"))
    end

    it "shows no organization entry to a regular member" do
      sign_in member
      get forms_path

      expect(app_bar_links.map(&:first)).not_to(include("Organización"))
    end
  end

  describe "GET /organizations/:id/forms" do
    it "shows the forms and members tabs with forms current" do
      sign_in org_admin
      get organization_forms_path(organization)

      tabs = page.css("nav.page-tabs a")
      expect(tabs.map { |tab| tab.text.strip }).to(eq(["Formularios", "Miembros"]))
      expect(tabs.first["aria-current"]).to(eq("page"))
      expect(tabs.last["href"]).to(eq(organization_memberships_path(organization)))
    end

    it "labels each form's date in Spanish" do
      create(:form, user: member, name: "La Esperanza", updated_at: Time.zone.local(2026, 10, 22, 9))
      sign_in org_admin
      get organization_forms_path(organization)

      expect(page.at("table tbody").text).to(include("Actualizado 22 oct 2026"))
    end

    it "links a form name only for viewers who may open it" do
      create(:form, user: org_admin, name: "Mi Finca")
      create(:form, user: member, name: "La Esperanza")
      sign_in member
      get organization_forms_path(organization)

      expect(page.css("table tbody a").map { |link| link.text.strip }).to(eq(["La Esperanza"]))
      expect(page.at("table tbody").text).to(include("Mi Finca"))
    end

    it "links every member's form for an org admin" do
      form = create(:form, user: member, name: "La Esperanza")
      sign_in org_admin
      get organization_forms_path(organization)

      expect(page.at("table tbody a")["href"]).to(eq(form_path(form)))
    end

    it "labels every cell so rows stack on phones" do
      create(:form, user: member, name: "La Esperanza")
      sign_in org_admin
      get organization_forms_path(organization)

      expect(page.at("table")["class"]).to(include("data-table-stacked"))
      labels = page.css("table tbody tr:first-child td").map { |cell| cell["data-label"] }
      expect(labels).to(eq(["Nombre", "Nombre del predio", "Estado", "Ubicación", "Fecha"]))
    end
  end

  describe "GET /organizations/:id/memberships" do
    it "puts the invitation as the primary action for an org admin" do
      sign_in org_admin
      get organization_memberships_path(organization)

      tabs = page.css("nav.page-tabs a")
      expect(tabs.last["aria-current"]).to(eq("page"))
      expect(page.css("a.btn-primary").map { |link| link.text.strip }).to(eq(["Invitar miembro"]))
    end

    it "hides the invitation and the admin tabs from a regular member" do
      sign_in member
      get organization_memberships_path(organization)

      expect(page.css("nav.page-tabs")).to(be_empty)
      expect(response.body).not_to(include("Invitar miembro"))
    end

    it "names the member in the remove action and its confirmation" do
      sign_in org_admin
      get organization_memberships_path(organization)

      button = page.css("form button").find { |candidate| candidate.text.strip == "Quitar" }
      expect(button["aria-label"]).to(eq("Quitar a Luis Soto"))
      expect(button["data-turbo-confirm"]).to(eq("¿Quitar a Luis Soto de Cooperativa Sur?"))
    end

    it "prints join dates with the Spanish format" do
      Membership.update_all(created_at: Time.zone.local(2026, 10, 22, 9))
      sign_in org_admin
      get organization_memberships_path(organization)

      expect(page.at("table tbody").text).to(include("22 oct 2026"))
    end

    it "labels every data cell so rows stack on phones" do
      sign_in org_admin
      get organization_memberships_path(organization)

      expect(page.at("table")["class"]).to(include("data-table-stacked"))
      labels = page.css("table tbody tr:first-child td").map { |cell| cell["data-label"] }
      expect(labels).to(eq(["Nombre", "Correo electrónico", "Rol", "Ingreso", nil]))
    end
  end

  describe "GET /organizations/:id/invitations/new" do
    it "uses a Spanish email placeholder" do
      sign_in org_admin
      get new_organization_invitation_path(organization)

      expect(page.at("input[type=email]")["placeholder"]).to(eq("nombre@ejemplo.com"))
    end
  end

  describe "a super admin who is not a member" do
    let(:super_admin) { create(:user, :super_admin) }

    before { sign_in super_admin }

    it "sees the organization's forms" do
      get organization_forms_path(organization)

      expect(response).to(have_http_status(:ok))
    end

    it "gets the invitation action on the members page" do
      get organization_memberships_path(organization)

      expect(response).to(have_http_status(:ok))
      expect(page.css("a.btn-primary").map { |link| link.text.strip }).to(eq(["Invitar miembro"]))
    end

    it "invites a member" do
      post organization_invitations_path(organization), params: { invitation: { email: "nuevo@example.com" } }

      expect(organization.users.find_by(email: "nuevo@example.com")).to(be_present)
    end

    it "removes a member" do
      membership = organization.memberships.find_by!(user: member)
      delete organization_membership_path(organization, membership)

      expect(organization.memberships.exists?(user: member)).to(be(false))
    end
  end
end
