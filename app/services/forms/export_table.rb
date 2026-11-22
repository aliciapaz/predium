# frozen_string_literal: true

module Forms
  # The rows of a forms export: a header row, then one row per form with the
  # farm, who filled it in, its scores and every answer. Indicator columns span
  # every territory, so a form leaves the ones outside its chain blank.
  class ExportTable
    TIME_FORMAT = "%Y-%m-%d %H:%M"
    SYSTEM_TYPE_SEPARATOR = ", "

    def initialize(forms)
      @forms = forms.with_user.with_responses
    end

    def call
      [headers] + forms.map { |form| values_for(form) }
    end

    private

    attr_reader :forms

    def headers
      farm_headers + principle_headers + dimension_headers + [t("results.overall_score")] + indicator_headers
    end

    def values_for(form)
      scores = Scoring::Calculator.new(form).call

      farm_values(form) +
        scores[:l1_scores].values +
        dimension_values(scores[:l2_scores]) +
        [scores[:overall]] +
        indicators.map { |ind| scores[:indicator_scores][ind[:key]] }
    end

    def farm_headers
      [
        t("labels.farm_name"), t("exports.created_by"), t("labels.email"), t("labels.status"),
        t("farm_info.national_id"), t("farm_info.date_of_birth"), t("farm_info.phone"), t("farm_info.gender"),
        t("farm_info.workforce_people"), t("farm_info.land_area_ha"), t("farm_info.system_types"),
        t("farm_info.country"), t("farm_info.region"), t("farm_info.locality"),
        t("farm_info.latitude"), t("farm_info.longitude"), t("exports.territory"), t("farm_info.observations"),
        *[t("labels.created_at"), t("labels.updated_at"), t("exports.completed_at")].map { |label| t("exports.utc", label:) },
      ]
    end

    def farm_values(form)
      [
        form.name, "#{form.user.first_name} #{form.user.last_name}", form.user.email, t("states.#{form.state}"),
        form.national_id, form.date_of_birth&.iso8601, form.phone, (t("farm_info.genders.#{form.gender}") if form.gender),
        form.work_force, form.land_area&.to_f, system_types(form),
        form.country, form.region, form.locality,
        form.latitude&.to_f, form.longitude&.to_f, territory(form), form.observations,
        timestamp(form.created_at), timestamp(form.updated_at), timestamp(form.completed_at),
      ]
    end

    def principle_headers
      QuestionnaireConfig.principles.map { |principle| t("exports.principle", name: t("#{principle[:i18n_key]}.name")) }
    end

    def dimension_headers
      QuestionnaireConfig.dimensions.map { |dim| t("exports.dimension", name: t(dim[:i18n_key])) }
    end

    def indicator_headers
      indicators.map { |ind| t("exports.indicator", name: t("#{ind[:i18n_key]}.name")) }
    end

    # A dimension with nothing scored comes back as 0, which no answer can
    # produce, so it is left blank rather than read as a real score.
    def dimension_values(l2_scores)
      l2_scores.values.map { |score| score unless score.zero? }
    end

    def indicators
      @indicators ||= QuestionnaireConfig.extension_keys
        .flat_map { |key| QuestionnaireConfig.extension_indicators(key) }
        .uniq { |ind| ind[:key] }
    end

    def system_types(form)
      Array(form.system_types).map { |type| t("farm_info.system_#{type}") }.join(SYSTEM_TYPE_SEPARATOR).presence
    end

    # A form keeps its key if its territory has since left the questionnaire,
    # as scoring does, rather than failing the whole export.
    def territory(form)
      key = form.territory_key
      return key unless QuestionnaireConfig.extension_keys.include?(key)

      t(QuestionnaireConfig.extension(key)[:i18n_key])
    end

    def timestamp(time)
      time&.strftime(TIME_FORMAT)
    end

    def t(key, **options)
      I18n.t(key, **options)
    end
  end
end
