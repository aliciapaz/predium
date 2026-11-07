# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Forms", type: :request) do
  let(:user) { create(:user) }

  before { sign_in user }

  def page
    Nokogiri::HTML(response.body)
  end

  describe "GET /forms" do
    it "tells the offline layer whose session it is, so unsynced work stays with its owner" do
      get forms_path

      expect(page.at("meta[name='predium-user']")["content"]).to(eq(user.id.to_s))
    end

    it "warns before signing out with unsynced changes" do
      get forms_path

      expect(page.css("form[data-controller='sign-out']").size).to(eq(2))
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

    it "redirects a draft to the editor" do
      form = create(:form, user: user)
      get form_path(form)
      expect(response).to(redirect_to(edit_form_path(form)))
    end

    it "renders the shell for a form that only exists client-side" do
      get form_path(SecureRandom.uuid)
      expect(response).to(have_http_status(:ok))
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
