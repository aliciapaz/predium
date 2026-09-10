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
end
