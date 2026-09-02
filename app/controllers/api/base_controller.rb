# frozen_string_literal: true

module Api
  class BaseController < ApplicationController
    before_action :require_authenticated_user

    private

    # Devise's authenticate_user! redirects to the login page; the sync client
    # needs a bare 401 so it can pause the queue instead of caching HTML.
    def require_authenticated_user
      return if user_signed_in?

      render(json: { error: "unauthenticated" }, status: :unauthorized)
    end
  end
end
