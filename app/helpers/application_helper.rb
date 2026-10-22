# frozen_string_literal: true

module ApplicationHelper
  def admin_sidebar_link(label, path)
    active = current_page?(path)
    base = "flex items-center min-h-11 px-3 rounded-lg text-sm font-semibold transition-colors"
    classes = active ? "#{base} bg-deep-hover text-deep-ink" : "#{base} text-deep-soft hover:bg-deep-hover hover:text-deep-ink"
    link_to(label, path, class: classes, "aria-current": (active ? "page" : nil))
  end

  def nav_link(label, path, css: "")
    active = current_page?(path)
    link_to(label, path, class: class_names("app-nav-link", css), "aria-current": (active ? "page" : nil))
  end
end
