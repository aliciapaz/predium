# frozen_string_literal: true

class AccountsController < ApplicationController
  before_action :authenticate_user!

  def edit
  end

  def update
    @name_user = User.find(current_user.id)

    if @name_user.update(params.expect(user: [:first_name, :last_name]))
      redirect_to(edit_account_path, notice: t("flash.name_updated"))
    else
      render(:edit, status: :unprocessable_content)
    end
  end
end
