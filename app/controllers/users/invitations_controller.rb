# frozen_string_literal: true

module Users
  class InvitationsController < Devise::InvitationsController
    before_action :require_super_admin, only: [:new, :create]

    private

    def require_super_admin
      head(:forbidden) unless current_user.super_admin?
    end
  end
end
