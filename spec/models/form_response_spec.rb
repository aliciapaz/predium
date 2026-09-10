# frozen_string_literal: true

require "rails_helper"

RSpec.describe(FormResponse, type: :model) do
  describe "validations" do
    it "is valid with a core indicator key and a value in range" do
      response = build(:form_response, indicator_key: "soil_coverage", value: 5)
      expect(response).to(be_valid)
    end

    it "rejects an indicator key that is not in the questionnaire config" do
      response = build(:form_response, indicator_key: "totally_bogus_key", value: 5)
      expect(response).not_to(be_valid)
      expect(response.errors[:indicator_key]).to(be_present)
    end

    it "rejects a blank indicator key" do
      response = build(:form_response, indicator_key: nil)
      expect(response).not_to(be_valid)
    end

    it "rejects values outside 1..10" do
      expect(build(:form_response, value: 0)).not_to(be_valid)
      expect(build(:form_response, value: 11)).not_to(be_valid)
    end

    it "rejects non-integer values" do
      expect(build(:form_response, value: 5.5)).not_to(be_valid)
    end

    it "rejects a duplicate indicator key on the same form" do
      existing = create(:form_response)
      duplicate = build(:form_response, form: existing.form, indicator_key: existing.indicator_key)
      expect(duplicate).not_to(be_valid)
    end
  end
end
