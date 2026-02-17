module Organizations
  class MembershipsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_access
    before_action :authorize_org_admin, only: [:destroy]

    def index
      @memberships = @organization.memberships.includes(:user).order(created_at: :asc)
    end

    def destroy
      membership = @organization.memberships.find(params[:id])
      membership.destroy
      redirect_to organization_memberships_path(@organization), notice: t("flash.member_removed")
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

    def authorize_org_admin
      unless current_user.memberships.exists?(organization: @organization, role: :admin)
        redirect_to organization_memberships_path(@organization), alert: t("flash.unauthorized")
      end
    end
  end
end
