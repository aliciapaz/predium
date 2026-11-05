# frozen_string_literal: true

module Admin
  module DashboardHelper
    ELEVATED_ROLES = ["super_admin", "admin"].freeze

    def format_admin_date(date)
      return "-" if date.blank?

      l(date, format: :short)
    end

    def role_badge(role, organization: nil)
      text = t("roles.#{role}")
      text = t("admin.role_in_organization", role: text, organization: organization.name) if organization
      badge(text, tone: ELEVATED_ROLES.include?(role.to_s) ? :success : :neutral)
    end
  end
end
