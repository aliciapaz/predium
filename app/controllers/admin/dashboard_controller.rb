module Admin
  class DashboardController < Admin::BaseController
    def show
      @total_users = User.count
      @total_organizations = Organization.count

      forms = Form.all
      forms = forms.by_country(params[:country]) if params[:country].present?
      forms = forms.where("completed_at >= ?", params[:date_from].to_date.beginning_of_day) if params[:date_from].present?
      forms = forms.where("completed_at <= ?", params[:date_to].to_date.end_of_day) if params[:date_to].present?

      @total_forms = forms.count
      @completed_forms = forms.completed.count
      @draft_forms = forms.draft.count
      @countries = Form.distinct.where.not(country: [nil, ""]).pluck(:country).sort
      @recent_forms = forms.completed
                           .includes(:user)
                           .order(completed_at: :desc)
                           .limit(10)
    end
  end
end
