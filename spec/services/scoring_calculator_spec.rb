# frozen_string_literal: true

require "rails_helper"

# Pins the Ruby calculator to spec/fixtures/scoring_parity.json, the shared
# fixture that app/javascript/lib/scoring.js is manually verified against
# (the JS port must produce these exact numbers for the same responses).
RSpec.describe(Scoring::Calculator) do
  let(:fixture) { JSON.parse(Rails.root.join("spec/fixtures/scoring_parity.json").read) }

  it "matches the shared parity fixture" do
    form = create(:form)
    fixture["responses"].each do |key, value|
      create(:form_response, form: form, indicator_key: key, value: value)
    end

    result = described_class.new(form).call

    expect(result[:l2_scores].transform_keys(&:to_s)).to(eq(fixture["expected"]["l2_scores"]))
    expect(result[:l1_scores].transform_keys(&:to_s)).to(eq(fixture["expected"]["l1_scores"]))
  end
end
