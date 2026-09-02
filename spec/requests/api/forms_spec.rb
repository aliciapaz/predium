# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Api::Forms", type: :request) do
  let(:user) { create(:user) }
  let(:indicator_key) { QuestionnaireConfig.core_indicators.first[:key] }

  before { sign_in user }

  def upsert(client_id, form: {}, responses: {}, base: nil, force: false)
    put(
      "/api/forms/#{client_id}",
      params: { form: { name: "Sync Farm" }.merge(form), responses: responses, base_updated_at: base, force: force },
      as: :json,
    )
  end

  describe "GET /api/forms" do
    it "returns only the current user's kept forms with nested responses" do
      form = create(:form, user: user)
      create(:form_response, form: form, indicator_key: indicator_key, value: 7)
      create(:form, :discarded, user: user)
      create(:form)

      get "/api/forms"

      expect(response).to(have_http_status(:ok))
      forms = JSON.parse(response.body)["forms"]
      expect(forms.size).to(eq(1))
      expect(forms.first["client_id"]).to(eq(form.client_id))
      expect(forms.first["responses"]).to(eq([{ "indicator_key" => indicator_key, "value" => 7, "is_extension" => false }]))
      expect(forms.first["updated_at"]).to(be_present)
    end

    it "rejects unauthenticated requests with 401 JSON" do
      sign_out user
      get "/api/forms"

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "PUT /api/forms/:client_id" do
    let(:client_id) { SecureRandom.uuid }

    it "creates a form with responses and sets synchronized_at" do
      expect do
        upsert(client_id, responses: { indicator_key => 7 })
      end.to(change(Form, :count).by(1))

      expect(response).to(have_http_status(:ok))
      form = user.forms.find_by!(client_id: client_id)
      expect(form.name).to(eq("Sync Farm"))
      expect(form.synchronized_at).to(be_present)
      expect(form.form_responses.find_by(indicator_key: indicator_key).value).to(eq(7))
      expect(JSON.parse(response.body)["form"]["client_id"]).to(eq(client_id))
    end

    it "is idempotent when the same payload is repeated" do
      upsert(client_id, responses: { indicator_key => 7 })

      expect do
        upsert(client_id, responses: { indicator_key => 7 })
      end.not_to(change(FormResponse, :count))

      expect(response).to(have_http_status(:ok))
      expect(Form.where(client_id: client_id).count).to(eq(1))
    end

    context "with a stale draft" do
      let(:form) { create(:form, user: user, name: "Server Name") }

      it "returns 409 with the server copy" do
        upsert(form.client_id, form: { name: "Offline Name" }, base: 1.hour.ago.iso8601(3))

        expect(response).to(have_http_status(:conflict))
        conflict = JSON.parse(response.body)["conflict"]
        expect(conflict["reason"]).to(eq("stale"))
        expect(conflict["form"]["name"]).to(eq("Server Name"))
        expect(form.reload.name).to(eq("Server Name"))
      end

      it "wins with force: true and bumps synchronized_at" do
        upsert(form.client_id, form: { name: "Offline Name" }, base: 1.hour.ago.iso8601(3), force: true)

        expect(response).to(have_http_status(:ok))
        expect(form.reload.name).to(eq("Offline Name"))
        expect(form.synchronized_at).to(be_present)
      end
    end

    it "accepts a fresh base_updated_at without force" do
      form = create(:form, user: user)

      upsert(form.client_id, form: { name: "Fresh Edit" }, base: form.updated_at.iso8601(3))

      expect(response).to(have_http_status(:ok))
      expect(form.reload.name).to(eq("Fresh Edit"))
    end

    it "returns 409 for a completed form regardless of force" do
      form = create(:form, :completed_with_responses, user: user)
      original = form.form_responses.find_by(indicator_key: indicator_key).value

      upsert(
        form.client_id,
        form: { name: form.name },
        responses: { indicator_key => original == 10 ? 1 : original + 1 },
        base: form.updated_at.iso8601(3),
        force: true,
      )

      expect(response).to(have_http_status(:conflict))
      expect(JSON.parse(response.body)["conflict"]["reason"]).to(eq("completed"))
      expect(form.form_responses.find_by(indicator_key: indicator_key).value).to(eq(original))
    end

    it "returns 422 with per-key errors for unknown indicator keys" do
      upsert(client_id, responses: { "totally_bogus_key" => 5 })

      expect(response).to(have_http_status(:unprocessable_entity))
      errors = JSON.parse(response.body)["errors"]
      expect(errors["totally_bogus_key"]).to(be_present)
      expect(Form.find_by(client_id: client_id)).to(be_nil)
    end

    it "returns 422 for out-of-range values" do
      upsert(client_id, responses: { indicator_key => 11 })

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(Form.find_by(client_id: client_id)).to(be_nil)
    end

    it "returns a deleted marker for a form discarded on the server" do
      form = create(:form, :discarded, user: user)

      upsert(form.client_id, base: form.updated_at.iso8601(3))

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)["deleted"]).to(be(true))
    end

    it "rejects unauthenticated requests with 401 JSON" do
      sign_out user
      upsert(client_id)

      expect(response).to(have_http_status(:unauthorized))
    end
  end
end
