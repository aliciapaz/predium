class FormPolicy < ApplicationPolicy
  def show?
    owner? || super_admin?
  end

  def create?
    true
  end

  def update?
    owner? || super_admin?
  end

  def destroy?
    owner? || super_admin?
  end
end
