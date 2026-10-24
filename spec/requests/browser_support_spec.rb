# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Browser support", type: :request) do
  def visit_with(user_agent)
    get(new_user_session_path, headers: { "User-Agent" => user_agent })
  end

  it "lets in iPhones stuck on iOS 16, which still meet the app's floor" do
    visit_with("Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1")

    expect(response).to(have_http_status(:ok))
  end

  it "lets in Android 7 phones whose Chrome stopped updating at 119" do
    visit_with("Mozilla/5.0 (Linux; Android 7.0; SM-G930F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36")

    expect(response).to(have_http_status(:ok))
  end

  it "turns away browsers without import maps before any data can be entered, in Spanish" do
    visit_with("Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1")

    expect(response).to(have_http_status(:not_acceptable))
    expect(response.body).to(include("Este navegador es demasiado antiguo para Predium"))
  end
end
