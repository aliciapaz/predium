class ProfilesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_profile

  def show
  end

  def edit
  end

  def update
    if @profile.update(profile_params)
      current_user.update(locale: locale_param) if locale_param.present?
      redirect_to profile_path, notice: t("flash.profile_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_profile
    @profile = current_user.profile || current_user.build_profile
  end

  def profile_params
    params.expect(profile: [:phone, :role_name, :country, :region, :locality])
  end

  def locale_param
    params.dig(:user, :locale)
  end
end
