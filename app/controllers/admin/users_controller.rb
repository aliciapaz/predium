# frozen_string_literal: true

module Admin
  class UsersController < Admin::BaseController
    before_action :set_user, only: [:show, :edit, :update]

    def index
      @users = User.ordered_by_name.with_organizations_and_forms
      @users = @users.search(params[:q]) if params[:q].present?
    end

    def show
      @memberships = @user.memberships.with_organization
      @recent_forms = @user.forms.recent(10)
    end

    def edit
    end

    def update
      if @user.update(user_params)
        redirect_to(admin_user_path(@user), notice: t("flash.user_role_updated"))
      else
        render(:edit, status: :unprocessable_entity)
      end
    end

    private

    def set_user
      @user = User.find(params[:id])
    end

    def user_params
      params.expect(user: [:platform_role])
    end
  end
end
