# frozen_string_literal: true

module FormsExport
  private

  def send_forms_export(forms, name)
    format = request.format.to_sym
    send_data(Forms::Export.new(forms, format: format).call, filename: "#{name}-#{Date.current.iso8601}.#{format}")
  end
end
