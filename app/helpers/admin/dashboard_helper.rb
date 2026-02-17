module Admin
  module DashboardHelper
    def format_admin_date(date)
      return "—" if date.blank?

      date.strftime("%b %d, %Y")
    end

    def role_badge(role)
      classes = case role.to_s
      when "super_admin"
        "bg-forest-100 text-forest-800"
      when "admin"
        "bg-mustard-100 text-mustard-800"
      else
        "bg-earth-200 text-earth-700"
      end

      tag.span role.to_s.titleize, class: "inline-block rounded-full px-2 py-1 text-xs font-medium #{classes}"
    end
  end
end
