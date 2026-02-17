class ApplicationPolicy < ActionPolicy::Base
  private

  def owner?
    record.user_id == user.id
  end

  def super_admin?
    user.super_admin?
  end
end
