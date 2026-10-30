# frozen_string_literal: true

module Accounts
  class PasswordsController < ApplicationController
    before_action :authenticate_user!

    def update
      @password_user = User.find(current_user.id)

      if change_password
        bypass_sign_in(@password_user)
        redirect_to(edit_account_path, notice: t("flash.password_changed"))
      else
        render("accounts/edit", status: :unprocessable_content)
      end
    end

    private

    # Devise drops a blank new password and reports success without changing
    # anything, so a blank one is refused here.
    def change_password
      password_params = params.expect(user: [:current_password, :password, :password_confirmation])
      return @password_user.update_with_password(password_params) if password_params[:password].present?

      @password_user.errors.add(:password, :blank)
      false
    end
  end
end
