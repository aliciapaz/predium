# frozen_string_literal: true

# Layer 2 primitives for server-rendered views. Each helper refuses invalid
# composition by raising, so a broken call fails in development and in specs
# instead of rendering inaccessible markup. lib/ui.js mirrors these for the
# markup Stimulus controllers render.
module DesignSystemHelper
  ICONS = {
    chevron_left: '<path d="m15 18-6-6 6-6"/>',
    chevron_right: '<path d="m9 18 6-6-6-6"/>',
    chevron_down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5h.01"/>',
    location: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  }.freeze

  # Whole class names, never interpolated: Tailwind only generates classes it
  # can read in the source.
  BADGE_CLASSES = {
    neutral: "badge-neutral",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
  }.freeze
  ALERT_CLASSES = { success: "alert-success", warning: "alert-warning", danger: "alert-danger" }.freeze
  ALERT_ICONS = { success: :check, warning: :info, danger: :alert }.freeze

  def icon(name, css: "w-5 h-5")
    paths = ICONS.fetch(name) do
      raise ArgumentError, "Unknown icon :#{name}. Known icons: #{ICONS.keys.join(", ")}. Add new ones to DesignSystemHelper::ICONS."
    end
    tag.svg(
      paths.html_safe,
      class: css,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": true,
    )
  end

  def icon_button(name, label:, type: "button", **attrs)
    if label.blank?
      raise ArgumentError, "icon_button(:#{name}) needs a label: the icon is not an accessible name."
    end

    attrs[:class] = class_names("icon-btn", attrs[:class])
    tag.button(icon(name), type: type, "aria-label": label, title: label, **attrs)
  end

  # A labelled text control (input, select or textarea) with the field
  # primitive applied. `id` and `label` are required so the label is always
  # associated with its control.
  def labeled_field(id:, label:, as: :input, hint: nil, options: [], wrapper: nil, **attrs)
    raise ArgumentError, "labeled_field needs an id so its label can point at it." if id.blank?
    raise ArgumentError, "labeled_field ##{id} needs a visible label." if label.blank?

    hint_id = "#{id}_hint" if hint
    control_attrs = { id: id, class: class_names("field", attrs.delete(:class)), "aria-describedby": hint_id }.merge(attrs)

    tag.div(class: wrapper) do
      safe_join([
        label_tag(id, label, class: "field-label"),
        field_control(as, options, control_attrs),
        (tag.p(hint, id: hint_id, class: "field-hint") if hint),
      ].compact)
    end
  end

  def badge(text, tone:)
    css = BADGE_CLASSES.fetch(tone) do
      raise ArgumentError, "badge tone :#{tone} is not one of #{BADGE_CLASSES.keys.join(", ")}."
    end
    tag.span(text, class: css)
  end

  def alert_box(message = nil, tone:, **attrs, &block)
    css = ALERT_CLASSES.fetch(tone) do
      raise ArgumentError, "alert tone :#{tone} is not one of #{ALERT_CLASSES.keys.join(", ")}."
    end
    body = block ? capture(&block) : message
    attrs[:class] = class_names(css, attrs[:class])
    attrs[:role] ||= tone == :danger ? "alert" : "status"
    tag.div(**attrs) { safe_join([icon(ALERT_ICONS.fetch(tone)), tag.div(body, class: "flex-1 min-w-0")]) }
  end

  def page_header(title, back: nil, subtitle: nil, &actions)
    tag.header(class: "page-header") do
      safe_join([
        (link_to(safe_join([icon(:chevron_left), back.first]), back.last, class: "back-link") if back),
        tag.div(class: "flex flex-wrap items-center justify-between gap-3") do
          safe_join([tag.h1(title, class: "page-title"), (capture(&actions) if actions)].compact)
        end,
        (tag.p(subtitle, class: "text-muted") if subtitle),
      ].compact)
    end
  end

  private

  def field_control(as, options, attrs)
    case as
    when :input then tag.input(type: "text", **attrs)
    when :select then tag.select(options_for_select(options, attrs.delete(:value)), **attrs)
    when :textarea then tag.textarea(attrs.delete(:value), **attrs)
    else raise ArgumentError, "labeled_field as: :#{as} is not one of :input, :select, :textarea."
    end
  end
end
