# frozen_string_literal: true

class OrganizationsController < ApplicationController
  before_action :authenticate_user!

  # A plain member's view of the forms list links to forms they cannot open,
  # so they land on the member list instead.
  def show
    organization = Organization.find(params[:id])

    if allowed_to?(:manage?, organization)
      redirect_to(organization_forms_path(organization))
    elsif allowed_to?(:show?, organization)
      redirect_to(organization_memberships_path(organization))
    else
      redirect_to(root_path, alert: t("flash.unauthorized"))
    end
  end
end
