# frozen_string_literal: true

# Default form builder (Layer 2). Every `form_with`/`form_for` control gets
# its design-system primitive without the view asking for it; a `class:`
# passed by the view is appended for layout, never replaces the primitive.
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
      super(method, with_primitive("field", options))
    end
  end

  def select(method, choices = nil, options = {}, html_options = {}, &block)
    super(method, choices, options, with_primitive("field", html_options), &block)
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
end
