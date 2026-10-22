# frozen_string_literal: true

module FormsHelper
  # The one way to print a diagnosis date: labelled, so a reader knows whether
  # it is the last edit or the completion, and localized.
  def form_date(form)
    if form.completed? && form.completed_at
      t("forms.completed_on", date: l(form.completed_at, format: :short))
    else
      t("forms.updated_on", date: l(form.updated_at, format: :short))
    end
  end
end
