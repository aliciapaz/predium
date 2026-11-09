# frozen_string_literal: true

module Api
  class BaseController < ApplicationController
    before_action :require_authenticated_user

    # A page served from the offline cache carries the token of a session the
    # OS may since have killed; hand the sync client a fresh one to retry with.
    rescue_from ActionController::InvalidAuthenticityToken do
      render(json: { error: "invalid_csrf_token", csrf_token: form_authenticity_token }, status: :forbidden)
    end

    private

    # Devise's authenticate_user! redirects to the login page; the sync client
    # needs a bare 401 so it can pause the queue instead of caching HTML.
    def require_authenticated_user
      return if user_signed_in?

      render(json: { error: "unauthenticated" }, status: :unauthorized)
    end
  end
end
