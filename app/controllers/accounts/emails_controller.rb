# frozen_string_literal: true

module Accounts
  class EmailsController < ApplicationController
    before_action :authenticate_user!

    def update
      @email_user = User.find(current_user.id)

      if @email_user.update_with_password(params.expect(user: [:email, :current_password]))
        redirect_to(edit_account_path, notice: notice_for(@email_user))
      else
        render("accounts/edit", status: :unprocessable_content)
      end
    end

    private

    def notice_for(user)
      if user.pending_reconfirmation?
        t("flash.email_change_pending", email: user.unconfirmed_email)
      else
        t("flash.email_unchanged")
      end
    end
  end
end
