# frozen_string_literal: true

class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :organization

  enum :role, { member: 0, admin: 1 }

  validates :user_id, uniqueness: { scope: :organization_id }

  scope :with_user, -> { includes(:user) }
  scope :with_organization, -> { includes(:organization) }
  scope :ordered_by_join_date, -> { order(created_at: :asc) }
  scope :ordered_by_user_name, -> { order("users.last_name") }
end
