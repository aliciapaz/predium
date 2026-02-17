module Organizations
  class FormsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_access

    def index
      @forms = Form.joins(user: :memberships)
                   .where(memberships: { organization_id: @organization.id })
                   .kept
                   .includes(:user)
                   .order(updated_at: :desc)

      @forms = @forms.where(state: params[:state]) if params[:state].present?
      @forms = @forms.where("forms.name ILIKE ?", "%#{Form.sanitize_sql_like(params[:search])}%") if params[:search].present?
    end

    private

    def set_organization
      @organization = Organization.find(params[:organization_id])
    end

    def authorize_org_access
      unless current_user.memberships.exists?(organization: @organization)
        redirect_to root_path, alert: t("flash.unauthorized")
      end
    end
  end
end
