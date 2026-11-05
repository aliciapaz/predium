# frozen_string_literal: true

# Default form builder (Layer 2). Every `form_with`/`form_for` control gets
# its design-system primitive without the view asking for it; a `class:`
# passed by the view is appended for layout, never replaces the primitive.
# An invalid control also gets its error message right under it.
class PrediumFormBuilder < ActionView::Helpers::FormBuilder
  TEXT_CONTROLS = [
    :text_field,
    :email_field,
    :password_field,
    :telephone_field,
    :phone_field,
    :number_field,
    :date_field,
    :url_field,
    :search_field,
    :text_area,
    :textarea,
  ].freeze

  TEXT_CONTROLS.each do |control|
    define_method(control) do |method, options = {}|
      with_error(method, options) { |described| super(method, with_primitive("field", described)) }
    end
  end

  def select(method, choices = nil, options = {}, html_options = {}, &block)
    with_error(method, html_options) do |described|
      super(method, choices, options, with_primitive("field", described), &block)
    end
  end

  def label(method, text = nil, options = {}, &block)
    if text.is_a?(Hash)
      options = text
      text = nil
    end
    super(method, text, with_primitive("field-label", options), &block)
  end

  def checkbox(method, options = {}, checked_value = "1", unchecked_value = "0")
    super(method, with_primitive("checkbox", options), checked_value, unchecked_value)
  end
  alias_method :check_box, :checkbox

  def submit(value = nil, options = {})
    if value.is_a?(Hash)
      options = value
      value = nil
    end
    primitive = options[:class].to_s.match?(/\bbtn-/) ? nil : "btn-primary"
    super(value, with_primitive(primitive, options))
  end

  private

  def with_primitive(primitive, options)
    options.merge(class: @template.class_names(primitive, options[:class]))
  end

  def with_error(method, options)
    message = error_message(method)
    return yield(options) unless message

    error_id = "#{field_id(method)}_error"
    described_by = @template.token_list(options[:"aria-describedby"], error_id)
    yield(options.merge("aria-describedby": described_by)) + @template.tag.p(message, id: error_id, class: "field-error")
  end

  def error_message(method)
    object.errors[method].first&.upcase_first if object.respond_to?(:errors)
  end
end
