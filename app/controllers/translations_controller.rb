class TranslationsController < ApplicationController
  def show
    locale = params[:locale]

    unless I18n.available_locales.map(&:to_s).include?(locale)
      head :not_found
      return
    end

    translations = flatten_translations(I18n.t(".", locale: locale))

    expires_in 1.hour, public: true
    render json: translations
  end

  private

  def flatten_translations(hash, prefix = nil)
    hash.each_with_object({}) do |(key, value), flat|
      full_key = [prefix, key].compact.join(".")
      if value.is_a?(Hash)
        flat.merge!(flatten_translations(value, full_key))
      else
        flat[full_key] = value.to_s
      end
    end
  end
end
