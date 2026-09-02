# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Admin::Users", type: :request) do
  let(:admin) { create(:user, :super_admin) }
  let(:user) { create(:user) }

  before { sign_in admin }

  describe "PATCH /admin/users/:id" do
    it "updates the platform role with a translated flash" do
      patch admin_user_path(user), params: { user: { platform_role: "super_admin" } }

      expect(user.reload).to(be_super_admin)
      expect(flash[:notice]).to(eq(I18n.t("flash.user_role_updated")))
    end
  end
end
