# frozen_string_literal: true

require "rails_helper"

RSpec.describe("PWA", type: :request) do
  describe "GET /manifest" do
    it "returns the manifest without authentication" do
      get pwa_manifest_path(format: :json)

      expect(response).to(have_http_status(:ok))
      manifest = JSON.parse(response.body)
      expect(manifest["start_url"]).to(eq("/"))
      expect(manifest["icons"]).to(be_present)
      expect(manifest["theme_color"]).to(eq("#347844"))
    end
  end

  describe "GET /service-worker" do
    it "returns JavaScript without authentication" do
      get pwa_service_worker_path(format: :js)

      expect(response).to(have_http_status(:ok))
      expect(response.body).to(include("addEventListener(\"fetch\""))
    end
  end
end
