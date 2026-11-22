# frozen_string_literal: true

module LocaleSetting
  extend ActiveSupport::Concern

  included do
    before_action :set_locale
  end

  private

  def set_locale
    I18n.locale = locale_from_params || locale_from_user || I18n.default_locale
  end

  def locale_from_user
    return unless user_signed_in?

    user_locale = current_user.locale
    user_locale if user_locale.present? && I18n.available_locales.map(&:to_s).include?(user_locale.to_s)
  end

  def locale_from_params
    loc = params[:locale]
    loc if loc.present? && I18n.available_locales.map(&:to_s).include?(loc.to_s)
  end

  # Links carry the locale only when it differs from the one the next request
  # would fall back to, so a language picked in the switch survives every link,
  # downloads included, even when it is the default and the user saved another.
  def default_url_options
    { locale: I18n.locale.to_s == (locale_from_user || I18n.default_locale).to_s ? nil : I18n.locale }
  end
end
