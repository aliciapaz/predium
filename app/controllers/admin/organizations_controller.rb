# frozen_string_literal: true

module Admin
  class OrganizationsController < Admin::BaseController
    before_action :set_organization, only: [:show, :edit, :update, :destroy]

    def index
      @organizations = Organization.with_member_counts
    end

    def show
      @members = @organization.memberships.with_user.ordered_by_user_name
      @recent_forms = Form.for_user_ids(@organization.user_ids).recent_completed(5)
      @forms_count = Form.for_user_ids(@organization.user_ids).count
    end

    def new
      @organization = Organization.new
    end

    def create
      @organization = Organization.new(organization_params)

      if @organization.save
        redirect_to(admin_organization_path(@organization), notice: "Organization created.")
      else
        render(:new, status: :unprocessable_entity)
      end
    end

    def edit
    end

    def update
      if @organization.update(organization_params)
        redirect_to(admin_organization_path(@organization), notice: "Organization updated.")
      else
        render(:edit, status: :unprocessable_entity)
      end
    end

    def destroy
      if @organization.memberships.exists?
        redirect_to(admin_organizations_path, alert: "Cannot delete organization with active members.")
      else
        @organization.destroy
        redirect_to(admin_organizations_path, notice: "Organization deleted.")
      end
    end

    private

    def set_organization
      @organization = Organization.find(params[:id])
    end

    def organization_params
      params.expect(organization: [:name])
    end
  end
end
