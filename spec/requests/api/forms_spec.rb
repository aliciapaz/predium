# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Api::Forms", type: :request) do
  let(:user) { create(:user) }
  let(:principle_key) { "biodiversity" }

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
      create(:form_response, form: form, indicator_key: principle_key, value: 7)
      create(:form, :discarded, user: user)
      create(:form)

      get "/api/forms"

      expect(response).to(have_http_status(:ok))
      forms = JSON.parse(response.body)["forms"]
      expect(forms.size).to(eq(1))
      expect(forms.first["client_id"]).to(eq(form.client_id))
      expect(forms.first["responses"]).to(eq([{ "indicator_key" => principle_key, "value" => 7, "is_extension" => false }]))
    end

    it "rejects unauthenticated requests with 401 JSON" do
      sign_out user
      get "/api/forms"
      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "PUT /api/forms/:client_id" do
    let(:client_id) { SecureRandom.uuid }

    it "creates a form with a principle response and sets synchronized_at" do
      expect do
        upsert(client_id, responses: { principle_key => 7 })
      end.to(change(Form, :count).by(1))

      expect(response).to(have_http_status(:ok))
      form = user.forms.find_by!(client_id: client_id)
      expect(form.synchronized_at).to(be_present)
      expect(form.form_responses.find_by(indicator_key: principle_key).value).to(eq(7))
    end

    it "is idempotent when the same payload is repeated" do
      upsert(client_id, responses: { principle_key => 7 })
      expect do
        upsert(client_id, responses: { principle_key => 7 })
      end.not_to(change(FormResponse, :count))
      expect(response).to(have_http_status(:ok))
    end

    it "accepts a chile indicator on a chile form and flags it as an extension" do
      upsert(client_id, form: { territory_key: "chile" }, responses: { principle_key => 5, "soil_coverage" => 8 })

      expect(response).to(have_http_status(:ok))
      form = user.forms.find_by!(client_id: client_id)
      expect(form.form_responses.find_by(indicator_key: "soil_coverage")).to(have_attributes(value: 8, is_extension: true))
    end

    it "rejects a chile key on a form with no territory" do
      upsert(client_id, responses: { "soil_coverage" => 5 })

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(JSON.parse(response.body)["errors"]["soil_coverage"]).to(be_present)
      expect(Form.find_by(client_id: client_id)).to(be_nil)
    end

    it "accepts a territory switch and its new keys in one push" do
      form = create(:form, user: user, territory_key: nil)
      create(:form_response, form: form, indicator_key: principle_key, value: 4)

      upsert(form.client_id, form: { territory_key: "chile" }, responses: { "soil_coverage" => 6 }, base: form.updated_at.iso8601(3))

      expect(response).to(have_http_status(:ok))
      expect(form.reload.territory_key).to(eq("chile"))
      expect(form.form_responses.find_by(indicator_key: "soil_coverage").value).to(eq(6))
    end

    it "rejects a chile key when the same push clears the territory" do
      form = create(:form, user: user, territory_key: "chile")

      upsert(form.client_id, form: { territory_key: nil }, responses: { "soil_coverage" => 5 }, base: form.updated_at.iso8601(3))

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(JSON.parse(response.body)["errors"]["soil_coverage"]).to(be_present)
    end

    it "prunes out-of-chain rows when the territory is cleared" do
      form = create(:form, user: user, territory_key: "chile")
      create(:form_response, form: form, indicator_key: principle_key, value: 3)
      create(:form_response, form: form, indicator_key: "soil_coverage", value: 9)

      upsert(form.client_id, form: { territory_key: nil }, responses: { principle_key => 3 }, base: form.updated_at.iso8601(3))

      expect(response).to(have_http_status(:ok))
      keys = form.reload.form_responses.pluck(:indicator_key)
      expect(keys).to(contain_exactly(principle_key))
      serialized = JSON.parse(response.body)["form"]["responses"].map { |r| r["indicator_key"] }
      expect(serialized).not_to(include("soil_coverage"))
    end

    it "preserves in-chain responses when an unrelated field changes (prune is not destructive)" do
      form = create(:form, user: user, territory_key: "chile")
      create(:form_response, form: form, indicator_key: principle_key, value: 5)
      create(:form_response, form: form, indicator_key: "soil_coverage", value: 5)

      upsert(
        form.client_id,
        form: { name: "Renamed", territory_key: "chile" },
        responses: { principle_key => 5, "soil_coverage" => 5 },
        base: form.reload.updated_at.iso8601(3),
      )

      expect(response).to(have_http_status(:ok))
      expect(form.reload.form_responses.pluck(:indicator_key)).to(contain_exactly(principle_key, "soil_coverage"))
    end

    it "prunes a leftover out-of-chain key when a later push omits it" do
      form = create(:form, user: user, territory_key: "chile")
      create(:form_response, form: form, indicator_key: principle_key, value: 5)
      # A key from before this refactor: not a principle, not in any chain. Bypass
      # validation to simulate a row that predates the two-level config.
      FormResponse.new(form: form, indicator_key: "legacy_removed_key", value: 5, is_extension: false).save!(validate: false)

      upsert(form.client_id, form: { territory_key: "chile" }, responses: { principle_key => 5 }, base: form.reload.updated_at.iso8601(3))

      expect(response).to(have_http_status(:ok))
      expect(form.reload.form_responses.pluck(:indicator_key)).to(contain_exactly(principle_key))
    end

    it "reconciles a re-sent out-of-chain stored row instead of 422-looping" do
      form = create(:form, user: user, territory_key: nil)
      create(:form_response, form: form, indicator_key: principle_key, value: 5)
      # A row that went out-of-chain when its key moved into a territory this form
      # does not belong to; the client re-sends it (alongside a genuine edit)
      # before its own heal runs.
      FormResponse.new(form: form, indicator_key: "soil_coverage", value: 7, is_extension: true).save!(validate: false)

      upsert(
        form.client_id,
        form: { territory_key: nil },
        responses: { principle_key => 6, "soil_coverage" => 7 },
        base: form.reload.updated_at.iso8601(3),
      )

      expect(response).to(have_http_status(:ok))
      expect(form.reload.form_responses.pluck(:indicator_key)).to(contain_exactly(principle_key))
      expect(form.form_responses.find_by(indicator_key: principle_key).value).to(eq(6))
    end

    context "with a stale draft" do
      let(:form) { create(:form, user: user, name: "Server Name") }

      it "returns 409 with the server copy" do
        upsert(form.client_id, form: { name: "Offline Name" }, base: 1.hour.ago.iso8601(3))

        expect(response).to(have_http_status(:conflict))
        expect(JSON.parse(response.body)["conflict"]["reason"]).to(eq("stale"))
        expect(form.reload.name).to(eq("Server Name"))
      end

      it "wins with force: true" do
        upsert(form.client_id, form: { name: "Offline Name" }, base: 1.hour.ago.iso8601(3), force: true)

        expect(response).to(have_http_status(:ok))
        expect(form.reload.name).to(eq("Offline Name"))
      end
    end

    it "returns 409 for a completed form regardless of force" do
      form = create(:form, :completed, user: user)
      create(:form_response, form: form, indicator_key: principle_key, value: 5)

      upsert(form.client_id, responses: { principle_key => 6 }, base: form.updated_at.iso8601(3), force: true)

      expect(response).to(have_http_status(:conflict))
      expect(JSON.parse(response.body)["conflict"]["reason"]).to(eq("completed"))
      expect(form.form_responses.find_by(indicator_key: principle_key).value).to(eq(5))
    end

    it "returns 422 with per-key errors for unknown indicator keys" do
      upsert(client_id, responses: { "totally_bogus_key" => 5 })

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(JSON.parse(response.body)["errors"]["totally_bogus_key"]).to(be_present)
      expect(Form.find_by(client_id: client_id)).to(be_nil)
    end

    it "returns 422 for out-of-range values" do
      upsert(client_id, responses: { principle_key => 11 })

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
