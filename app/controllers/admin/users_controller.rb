module Admin
  class UsersController < Admin::BaseController
    before_action :set_user, only: [:show, :edit, :update]

    def index
      @users = User.all.order(:last_name, :first_name)

      if params[:q].present?
        query = "%#{params[:q]}%"
        @users = @users.where(
          "first_name ILIKE :q OR last_name ILIKE :q OR email ILIKE :q",
          q: query
        )
      end

      @users = @users.includes(:organizations, :forms)
    end

    def show
      @memberships = @user.memberships.includes(:organization)
      @recent_forms = @user.forms.order(created_at: :desc).limit(10)
    end

    def edit
    end

    def update
      if @user.update(user_params)
        redirect_to admin_user_path(@user), notice: "User role updated."
      else
        render :edit, status: :unprocessable_entity
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
