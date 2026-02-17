module ApplicationHelper
  def admin_sidebar_link(label, path)
    active = current_page?(path)
    base = "block px-3 py-2 rounded-md text-sm transition-colors"
    classes = active ? "#{base} bg-forest-900 text-white font-medium" : "#{base} text-forest-100 hover:bg-forest-700"
    link_to label, path, class: classes
  end
end
