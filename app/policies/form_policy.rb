# frozen_string_literal: true

class FormPolicy < ApplicationPolicy
  def show?
    owner? || super_admin? || owner_supervisor?
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

  private

  def owner_supervisor?
    user.administered_organization_for(record).present?
  end
end
