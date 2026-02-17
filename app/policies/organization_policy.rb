class OrganizationPolicy < ApplicationPolicy
  def show?
    member? || super_admin?
  end

  def manage?
    admin_member? || super_admin?
  end

  def admin_panel?
    super_admin?
  end

  private

  def member?
    record.memberships.exists?(user: user)
  end

  def admin_member?
    record.memberships.exists?(user: user, role: :admin)
  end
end
