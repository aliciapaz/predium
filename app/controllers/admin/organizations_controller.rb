module Admin
  class OrganizationsController < Admin::BaseController
    before_action :set_organization, only: [:show, :edit, :update, :destroy]

    def index
      @organizations = Organization.all
                                   .left_joins(:memberships)
                                   .select("organizations.*, COUNT(memberships.id) AS members_count")
                                   .group("organizations.id")
                                   .order(:name)
    end

    def show
      @members = @organization.memberships.includes(:user).order("users.last_name")
      @recent_forms = Form.where(user_id: @organization.user_ids)
                          .completed
                          .includes(:user)
                          .order(completed_at: :desc)
                          .limit(5)
      @forms_count = Form.where(user_id: @organization.user_ids).count
    end

    def new
      @organization = Organization.new
    end

    def create
      @organization = Organization.new(organization_params)

      if @organization.save
        redirect_to admin_organization_path(@organization), notice: "Organization created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def edit
    end

    def update
      if @organization.update(organization_params)
        redirect_to admin_organization_path(@organization), notice: "Organization updated."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      if @organization.memberships.exists?
        redirect_to admin_organizations_path, alert: "Cannot delete organization with active members."
      else
        @organization.destroy
        redirect_to admin_organizations_path, notice: "Organization deleted."
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
