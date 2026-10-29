# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Forms", type: :request) do
  let(:user) { create(:user) }

  before { sign_in user }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /forms" do
    it "deletes from the whole page, so the list does not lose the card's frame" do
      form = create(:form, user: user)
      get forms_path

      delete_form = page.at("form[data-turbo-confirm]")
      expect(delete_form["data-turbo-frame"]).to(eq("_top"))
      expect(delete_form["data-offline-forms-client-id-param"]).to(eq(form.client_id))
    end

    it "names the farm in the delete action and its confirmation" do
      create(:form, user: user, name: "La Esperanza")
      get forms_path

      form = page.at("form[data-turbo-confirm]")
      expect(form["data-turbo-confirm"]).to(eq("¿Eliminar el diagnóstico de La Esperanza?"))
      expect(form.at("button")["aria-label"]).to(eq("Eliminar el diagnóstico de La Esperanza"))
    end

    it "labels a draft's date as its last update" do
      create(:form, user: user, updated_at: Time.zone.local(2026, 10, 22, 9))
      get forms_path

      expect(page.at("article").text).to(include("Actualizado 22 oct 2026"))
    end

    it "labels a completed form's date as its completion" do
      create(:form, :completed, user: user, completed_at: Time.zone.local(2026, 10, 20, 9))
      get forms_path

      expect(page.at("article").text).to(include("Completado 20 oct 2026"))
    end
  end

  describe "GET /forms/new" do
    it "renders the editor shell with no server-side form data" do
      get new_form_path

      expect(response).to(have_http_status(:ok))
      expect(response.body).to(include("form-editor"))
    end
  end

  describe "GET /forms/:id/edit" do
    context "when the form is a draft" do
      let(:form) { create(:form, user: user) }

      it "renders the editor shell" do
        get edit_form_path(form)
        expect(response).to(have_http_status(:ok))
        expect(response.body).to(include(form.client_id))
      end

      it "titles the shell as loading, never as a new questionnaire" do
        get edit_form_path(form)

        expect(page.at("h1").text.strip).to(eq("Cargando..."))
      end

      it "leaves coordinates on a keypad that has a minus sign" do
        get edit_form_path(form)

        expect(page.at("#farm_latitude")["inputmode"]).to(be_nil)
        expect(page.at("#farm_longitude")["inputmode"]).to(be_nil)
      end
    end

    context "when the form is completed" do
      let(:form) { create(:form, :completed, user: user) }

      it "redirects to the form" do
        get edit_form_path(form)
        expect(response).to(redirect_to(form_path(form)))
      end
    end

    context "when the form only exists client-side" do
      it "still renders the editor shell" do
        get edit_form_path(SecureRandom.uuid)
        expect(response).to(have_http_status(:ok))
      end
    end
  end

  describe "GET /forms/:id" do
    it "renders the results shell for a completed form" do
      form = create(:form, :completed, user: user)
      get form_path(form)
      expect(response).to(have_http_status(:ok))
    end

    it "offers no PDF action until the feature exists" do
      form = create(:form, :completed, user: user)
      get form_path(form)

      expect(response.body).not_to(include("Generar PDF"))
    end

    it "shows a draft's partial results with a way back to the questionnaire" do
      form = create(:form, user: user)
      get form_path(form)

      expect(response).to(have_http_status(:ok))
      expect(page.at("[data-results-target='continue']")["href"]).to(eq(edit_form_path(form)))
    end

    it "renders the shell for a form that only exists client-side" do
      get form_path(SecureRandom.uuid)
      expect(response).to(have_http_status(:ok))
    end

    it "leaves the owner's form to IndexedDB instead of embedding it" do
      form = create(:form, :completed, user: user)
      get form_path(form)

      expect(page.at("[data-controller=results]")["data-results-form-value"]).to(be_nil)
      expect(page.at("a.back-link")["href"]).to(eq(forms_path))
    end

    context "when another user owns the form" do
      let(:organization) { create(:organization) }
      let(:member) { create(:user) }
      let(:form) { create(:form, :completed, user: member, name: "Los Andes") }

      before do
        create(:membership, user: member, organization: organization)
        create(:form_response, form: form, indicator_key: "biodiversity", value: 7)
      end

      def embedded_form
        JSON.parse(page.at("[data-controller=results]")["data-results-form-value"])
      end

      context "with the viewer an admin of the owner's organization" do
        before { create(:membership, :admin, user: user, organization: organization) }

        it "embeds the form and its responses in the results shell" do
          get form_path(form)

          expect(response).to(have_http_status(:ok))
          expect(embedded_form).to(include("client_id" => form.client_id, "name" => "Los Andes", "state" => "completed"))
          expect(embedded_form["responses"]).to(eq([
            { "indicator_key" => "biodiversity", "value" => 7, "is_extension" => false },
          ]))
        end

        it "shows a draft as read-only results instead of redirecting to the editor" do
          draft = create(:form, user: member)
          get form_path(draft)

          expect(response).to(have_http_status(:ok))
          expect(embedded_form).to(include("client_id" => draft.client_id, "state" => "draft"))
          expect(page.at("[data-results-target='continue']")).to(be_nil)
        end

        it "links back to the organization's forms" do
          get form_path(form)

          expect(page.at("a.back-link")["href"]).to(eq(organization_forms_path(organization)))
        end
      end

      it "embeds the form for a super admin who is not in the organization" do
        user.update!(platform_role: :super_admin)
        get form_path(form)

        expect(response).to(have_http_status(:ok))
        expect(embedded_form).to(include("client_id" => form.client_id, "name" => "Los Andes"))
      end

      it "denies an admin of a different organization" do
        create(:membership, :admin, user: user, organization: create(:organization))
        get form_path(form)

        expect(response).to(redirect_to(root_path))
        expect(flash[:alert]).to(eq(I18n.t("flash.unauthorized")))
      end

      it "denies a regular member of the same organization" do
        create(:membership, user: user, organization: organization)
        get form_path(form)

        expect(response).to(redirect_to(root_path))
        expect(flash[:alert]).to(eq(I18n.t("flash.unauthorized")))
      end
    end
  end

  describe "DELETE /forms/:id" do
    it "soft deletes the form" do
      form = create(:form, user: user)
      delete form_path(form)

      expect(response).to(redirect_to(forms_path))
      expect(Form.unscoped.find(form.id)).to(be_discarded)
    end
  end
end
