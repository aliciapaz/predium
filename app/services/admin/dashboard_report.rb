# frozen_string_literal: true

module Admin
  # Builds the admin dashboard statistics, optionally filtered by country
  # and completion date range.
  class DashboardReport
    include ActiveModel::Model

    Result = Data.define(
      :total_users,
      :total_organizations,
      :total_forms,
      :completed_forms,
      :draft_forms,
      :countries,
      :recent_forms,
    )

    attr_accessor :country, :date_from, :date_to

    def call
      Result.new(
        total_users: User.count,
        total_organizations: Organization.count,
        total_forms: forms.count,
        completed_forms: forms.completed.count,
        draft_forms: forms.draft.count,
        countries: Form.countries,
        recent_forms: forms.recent_completed(10),
      )
    end

    private

    def forms
      @forms ||= filtered_forms
    end

    def filtered_forms
      scope = Form.all
      scope = scope.by_country(country) if country.present?
      scope = scope.completed_on_or_after(date_from.to_date.beginning_of_day) if date_from.present?
      scope = scope.completed_on_or_before(date_to.to_date.end_of_day) if date_to.present?
      scope
    end
  end
end
