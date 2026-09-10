# frozen_string_literal: true

class Organization < ApplicationRecord
  has_many :memberships, dependent: :destroy
  has_many :users, through: :memberships

  validates :name, presence: true, uniqueness: true

  scope :with_member_counts, -> {
    left_joins(:memberships)
      .select("organizations.*, COUNT(memberships.id) AS members_count")
      .group("organizations.id")
      .order(:name)
  }
end
