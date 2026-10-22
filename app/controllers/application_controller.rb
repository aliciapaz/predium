# frozen_string_literal: true

class ApplicationController < ActionController::Base
  include LocaleSetting

  # The app's real floor, not Rails' :modern default: import maps (no JS
  # without them) and the Tailwind v4 CSS (@property, color-mix, :has). It lets
  # in iPhone 8/X on iOS 16.4+ and Android 7 phones stuck on Chrome 119.
  allow_browser versions: { safari: 16.4, chrome: 111, firefox: 128, ie: false }
  stale_when_importmap_changes
  default_form_builder PrediumFormBuilder

  before_action :configure_permitted_parameters, if: :devise_controller?

  private

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:invite, keys: [:first_name, :last_name])
  end

  def current_organization
    @current_organization ||= current_user&.organizations&.first
  end
  helper_method :current_organization
end
