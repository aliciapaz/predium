module LocaleSetting
  extend ActiveSupport::Concern

  included do
    before_action :set_locale
  end

  private

  def set_locale
    I18n.locale = locale_from_user || locale_from_params || locale_from_header || I18n.default_locale
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

  def locale_from_header
    header = request.env["HTTP_ACCEPT_LANGUAGE"]
    return unless header

    preferred = header.split(",").map { |l| l.strip.split(";").first.split("-").first }.first
    preferred if preferred.present? && I18n.available_locales.map(&:to_s).include?(preferred)
  end

  def default_url_options
    { locale: I18n.locale == I18n.default_locale ? nil : I18n.locale }
  end
end
