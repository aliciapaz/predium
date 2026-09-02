# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Forms", type: :request) do
  let(:user) { create(:user) }

  before { sign_in user }

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
