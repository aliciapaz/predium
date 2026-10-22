# frozen_string_literal: true

class ApplicationController < ActionController::Base
  include LocaleSetting

  allow_browser versions: :modern
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
