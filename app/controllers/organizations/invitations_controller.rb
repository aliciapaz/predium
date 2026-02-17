module Organizations
  class InvitationsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_admin

    def new
    end

    def create
      email = invitation_params[:email]&.downcase&.strip
      role = invitation_params[:role] || "member"
      user = User.find_by(email: email)

      if user&.confirmed?
        if @organization.memberships.exists?(user: user)
          redirect_to organization_memberships_path(@organization), alert: t("flash.member_already_exists", default: "User is already a member of this organization.")
          return
        end

        @organization.memberships.create!(user: user, role: role)
      else
        user = User.invite!({ email: email, first_name: "Invited", last_name: "User" }, current_user)
        @organization.memberships.create!(user: user, role: role) unless @organization.memberships.exists?(user: user)
      end

      redirect_to organization_memberships_path(@organization), notice: t("flash.member_invited")
    end

    private

    def set_organization
      @organization = Organization.find(params[:organization_id])
    end

    def authorize_org_admin
      unless current_user.memberships.exists?(organization: @organization, role: :admin)
        redirect_to organization_memberships_path(@organization), alert: t("flash.unauthorized")
      end
    end

    def invitation_params
      params.expect(invitation: [:email, :role])
    end
  end
end
