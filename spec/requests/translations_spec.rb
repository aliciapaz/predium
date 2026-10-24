# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Translations", type: :request) do
  it "serves the flat locale map stamped with the version clients cache it under" do
    get "/translations/es"

    expect(response).to(have_http_status(:ok))
    expect(response.parsed_body["offline.online"]).to(eq(I18n.t("offline.online", locale: :es)))
    expect(response.headers["X-Translations-Version"]).to(eq(QuestionnaireConfig.fingerprint))
  end

  it "rejects locales the app does not offer" do
    get "/translations/fr"

    expect(response).to(have_http_status(:not_found))
  end
end
