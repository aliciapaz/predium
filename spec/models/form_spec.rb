# frozen_string_literal: true

require "rails_helper"

RSpec.describe(Form, type: :model) do
  describe "client_id" do
    it "is generated on create when absent" do
      form = create(:form)
      expect(form.client_id).to(be_present)
    end

    it "keeps a client-provided value" do
      client_id = SecureRandom.uuid
      form = create(:form, client_id: client_id)
      expect(form.client_id).to(eq(client_id))
    end

    it "must be unique" do
      existing = create(:form)
      duplicate = build(:form, client_id: existing.client_id)
      expect(duplicate).not_to(be_valid)
    end

    it "is used as the URL param" do
      form = create(:form)
      expect(form.to_param).to(eq(form.client_id))
    end
  end

  describe "territory_key validation" do
    it "accepts a known territory and blank, rejects an unknown one" do
      expect(build(:form, territory_key: "chile")).to(be_valid)
      expect(build(:form, territory_key: nil)).to(be_valid)
      expect(build(:form, territory_key: "atlantis")).not_to(be_valid)
    end

    it "rejects a path-traversal territory_key before it can reach the filesystem" do
      expect(build(:form, territory_key: "../../../etc/passwd")).not_to(be_valid)
      expect(build(:form, territory_key: "chile/../secret")).not_to(be_valid)
    end
  end

  describe "completion universe" do
    it "requires six keys without a territory and 78 with chile" do
      expect(build(:form, territory_key: nil).required_indicator_keys.size).to(eq(6))
      expect(build(:form, territory_key: "chile").required_indicator_keys.size).to(eq(78))
    end

    it "lists Principles first among missing sections" do
      form = create(:form, territory_key: "chile")
      expect(form.missing_sections.first).to(eq("questionnaire.principles_title"))
    end
  end
end
