# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Locale precedence", type: :request) do
  describe "GET / with a ?locale param" do
    context "when the signed-in user has a stored locale" do
      let(:user) { create(:user, locale: "es") }

      before { sign_in user }

      it "lets an explicit ?locale param override the stored preference" do
        get root_path(locale: "en")

        expect(response.body).to(include("Drafts"))
        expect(response.body).not_to(include("Borradores"))
      end

      it "falls back to the stored preference when no param is given" do
        get root_path

        expect(response.body).to(include("Borradores"))
      end
    end
  end
end
