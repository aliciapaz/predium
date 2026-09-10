# frozen_string_literal: true

module Organizations
  class FormsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_access

    def index
      @forms = Form.for_organization(@organization).with_user.recently_updated
      @forms = @forms.with_state(params[:state]) if params[:state].present?
      @forms = @forms.name_matches(params[:search]) if params[:search].present?
    end

    private

    def set_organization
      @organization = Organization.find(params[:organization_id])
    end

    def authorize_org_access
      unless current_user.memberships.exists?(organization: @organization)
        redirect_to(root_path, alert: t("flash.unauthorized"))
      end
    end
  end
end
