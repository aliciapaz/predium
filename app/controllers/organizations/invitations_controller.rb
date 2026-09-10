# frozen_string_literal: true

module Organizations
  class InvitationsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_admin

    def new
    end

    def create
      result = Organizations::MemberInviter.new(
        organization: @organization,
        email: invitation_params[:email],
        role: invitation_params[:role],
        invited_by: current_user,
      ).call

      redirect_to(organization_memberships_path(@organization), **flash_for(result))
    end

    private

    def flash_for(result)
      if result.status == :already_member
        { alert: t("flash.member_already_exists", default: "User is already a member of this organization.") }
      else
        { notice: t("flash.member_invited") }
      end
    end

    def set_organization
      @organization = Organization.find(params[:organization_id])
    end

    def authorize_org_admin
      unless current_user.memberships.exists?(organization: @organization, role: :admin)
        redirect_to(organization_memberships_path(@organization), alert: t("flash.unauthorized"))
      end
    end

    def invitation_params
      params.expect(invitation: [:email, :role])
    end
  end
end
