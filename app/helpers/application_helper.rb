# frozen_string_literal: true

module ApplicationHelper
  # Compares paths only: links carry ?locale= when the locale is not the
  # default, which current_page? would count as a different page.
  def admin_sidebar_link(label, path)
    active = URI(path).path == request.path
    base = "flex items-center min-h-11 px-3 rounded-lg text-sm font-semibold transition-colors"
    classes = active ? "#{base} bg-deep-ink text-deep" : "#{base} text-deep-soft hover:bg-deep-hover hover:text-deep-ink"
    link_to(label, path, class: classes, "aria-current": (active ? "page" : nil))
  end

  def nav_link(label, path, css: "", active: current_page?(path))
    link_to(label, path, class: class_names("app-nav-link", css), "aria-current": (active ? "page" : nil))
  end
end
