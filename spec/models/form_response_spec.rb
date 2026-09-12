# frozen_string_literal: true

require "rails_helper"

RSpec.describe(FormResponse, type: :model) do
  let(:chile_form) { create(:form, territory_key: "chile") }
  let(:no_territory_form) { create(:form, territory_key: nil) }

  describe "validations" do
    it "accepts a principle key regardless of territory" do
      expect(build(:form_response, form: no_territory_form, indicator_key: "biodiversity", value: 5)).to(be_valid)
      expect(build(:form_response, form: chile_form, indicator_key: "biodiversity", value: 5)).to(be_valid)
    end

    it "accepts a chile indicator key on a chile form" do
      expect(build(:form_response, form: chile_form, indicator_key: "soil_coverage", value: 5)).to(be_valid)
    end

    it "rejects a chile indicator key on a form with no territory" do
      response = build(:form_response, form: no_territory_form, indicator_key: "soil_coverage", value: 5)
      expect(response).not_to(be_valid)
      expect(response.errors[:indicator_key]).to(be_present)
    end

    it "rejects an indicator key that is in no questionnaire" do
      response = build(:form_response, form: chile_form, indicator_key: "totally_bogus_key", value: 5)
      expect(response).not_to(be_valid)
    end

    it "rejects a blank indicator key" do
      expect(build(:form_response, form: chile_form, indicator_key: nil)).not_to(be_valid)
    end

    it "rejects values outside 1..10" do
      expect(build(:form_response, form: chile_form, indicator_key: "biodiversity", value: 0)).not_to(be_valid)
      expect(build(:form_response, form: chile_form, indicator_key: "biodiversity", value: 11)).not_to(be_valid)
    end

    it "rejects a duplicate indicator key on the same form" do
      existing = create(:form_response, form: chile_form, indicator_key: "biodiversity")
      duplicate = build(:form_response, form: existing.form, indicator_key: "biodiversity")
      expect(duplicate).not_to(be_valid)
    end
  end

  describe "is_extension derivation" do
    it "is false for a principle and true for an indicator" do
      principle = create(:form_response, form: chile_form, indicator_key: "recycling", value: 5)
      indicator = create(:form_response, form: chile_form, indicator_key: "soil_coverage", value: 5)
      expect(principle.is_extension).to(be(false))
      expect(indicator.is_extension).to(be(true))
    end

    it "overrides an inconsistent assigned flag in both directions" do
      indicator = build(:form_response, form: chile_form, indicator_key: "soil_coverage", value: 5, is_extension: false)
      indicator.validate
      expect(indicator.is_extension).to(be(true))

      principle = build(:form_response, form: chile_form, indicator_key: "biodiversity", value: 5, is_extension: true)
      principle.validate
      expect(principle.is_extension).to(be(false))
    end
  end
end
