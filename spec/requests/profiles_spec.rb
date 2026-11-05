# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Profile", type: :request) do
  before { sign_in create(:user) }

  describe "GET /profile/edit" do
    it "leads back to the profile" do
      get edit_profile_path

      back = Nokogiri::HTML(response.body).at("a.back-link")
      expect(back["href"]).to(eq(profile_path))
      expect(back.text.strip).to(eq("Mi perfil"))
    end
  end
end
