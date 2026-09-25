# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Api::Questionnaires", type: :request) do
  describe "GET /api/questionnaire" do
    context "when authenticated" do
      before { sign_in create(:user) }

      it "returns principles, structure, and resolved extensions" do
        get api_questionnaire_path

        expect(response).to(have_http_status(:ok))
        payload = JSON.parse(response.body)
        expect(payload["fingerprint"]).to(be_present)
        expect(payload["principles"].size).to(eq(6))
        expect(payload["principles"]).to(all(include("key", "i18n_key", "position")))
        expect(payload["categories"].size).to(eq(6))
        expect(payload["dimensions"].size).to(eq(14))
        expect(payload["dimensions"]).to(all(include("key", "i18n_key", "category")))
        expect(payload).not_to(have_key("indicators"))

        chile = payload["extensions"]["chile"]
        expect(chile["extends"]).to(be_nil)
        expect(chile["indicators"].size).to(eq(72))
        expect(chile["indicators"]).to(all(include("key", "dimension", "i18n_key", "position", "extension" => "chile")))
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
