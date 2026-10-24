# frozen_string_literal: true

# Invalid controls get aria-invalid, which the field primitive styles and
# screen readers announce, instead of Rails' wrapper div, which breaks the
# grid and flex layouts fields sit in.
ActionView::Base.field_error_proc = proc do |html_tag, _instance|
  html_tag.sub(/\A<(input|select|textarea)\b/, '\0 aria-invalid="true"').html_safe
end
