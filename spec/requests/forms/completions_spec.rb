# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Forms::Completions", type: :request) do
  let(:user) { create(:user) }

  before { sign_in user }

  describe "POST /forms/:form_id/completion" do
    context "when all core indicators have responses" do
      let(:form) { create(:form, user: user) }

      before do
        QuestionnaireConfig.core_indicators.each do |ind|
          create(:form_response, form: form, indicator_key: ind[:key], value: 5)
        end
      end

      it "completes the form" do
        post form_completion_path(form)
        expect(form.reload).to(be_completed)
      end
    end

    context "when core indicators are missing" do
      let(:form) { create(:form, user: user) }

      it "redirects to the editor with a translated alert" do
        post form_completion_path(form)

        expect(response).to(redirect_to(edit_form_path(form)))

        missing_names = QuestionnaireConfig.dimensions.map { |d| I18n.t(d[:i18n_key]) }.join(", ")
        expect(flash[:alert]).to(eq(I18n.t("flash.missing_indicators", dimensions: missing_names)))
      end
    end

    context "when the form is already completed" do
      let(:form) { create(:form, :completed_with_responses, user: user) }

      it "redirects to the form without raising" do
        post form_completion_path(form)
        expect(response).to(redirect_to(form_path(form)))
      end
    end
  end
end
