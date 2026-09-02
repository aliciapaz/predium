# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Api::Questionnaires", type: :request) do
  describe "GET /api/questionnaire" do
    context "when authenticated" do
      before { sign_in create(:user) }

      it "returns the full questionnaire with a fingerprint" do
        get api_questionnaire_path

        expect(response).to(have_http_status(:ok))
        payload = JSON.parse(response.body)
        expect(payload["fingerprint"]).to(be_present)
        expect(payload["categories"].size).to(eq(6))
        # core.yml ships 14 dimensions; docs/architecture.md says 15 (doc drift)
        expect(payload["dimensions"].size).to(eq(14))
        expect(payload["indicators"].size).to(eq(74))
        expect(payload["indicators"]).to(all(include("key", "i18n_key", "dimension", "category")))
        expect(payload["extensions"]["chile"]["indicators"]).to(be_present)
      end

      it "serves the fingerprint computed from the questionnaire files" do
        get api_questionnaire_path

        expect(JSON.parse(response.body)["fingerprint"]).to(eq(QuestionnaireConfig.fingerprint))
      end
    end

    it "rejects unauthenticated requests with 401 JSON" do
      get api_questionnaire_path

      expect(response).to(have_http_status(:unauthorized))
      expect(JSON.parse(response.body)["error"]).to(eq("unauthenticated"))
    end
  end
end
