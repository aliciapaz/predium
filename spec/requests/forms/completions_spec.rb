# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Forms::Completions", type: :request) do
  let(:user) { create(:user) }

  before { sign_in user }

  def score(form, keys)
    keys.each { |key| create(:form_response, form: form, indicator_key: key, value: 5) }
  end

  describe "POST /forms/:form_id/completion" do
    context "a chile form with every principle and indicator scored" do
      let(:form) { create(:form, user: user, territory_key: "chile") }

      before { score(form, form.required_indicator_keys) }

      it "completes the form" do
        post form_completion_path(form)
        expect(form.reload).to(be_completed)
      end
    end

    context "a territory-less form with all principles scored" do
      let(:form) { create(:form, user: user, territory_key: nil) }

      before { score(form, QuestionnaireConfig.principle_keys) }

      it "completes on principles alone" do
        post form_completion_path(form)
        expect(form.reload).to(be_completed)
      end
    end

    context "a territory-less form missing a principle" do
      let(:form) { create(:form, user: user, territory_key: nil) }

      before { score(form, QuestionnaireConfig.principle_keys.drop(1)) }

      it "is refused and names the Principles section" do
        post form_completion_path(form)
        expect(response).to(redirect_to(edit_form_path(form)))
        expect(flash[:alert]).to(include(I18n.t("questionnaire.principles_title")))
      end
    end

    context "a chile form missing one indicator" do
      let(:form) { create(:form, user: user, territory_key: "chile") }

      before { score(form, form.required_indicator_keys - ["soil_coverage"]) }

      it "is refused and names that indicator's dimension" do
        post form_completion_path(form)
        expect(response).to(redirect_to(edit_form_path(form)))
        expect(flash[:alert]).to(include(I18n.t("questionnaire.dimensions.soil_health")))
        expect(flash[:alert]).not_to(include(I18n.t("questionnaire.principles_title")))
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
