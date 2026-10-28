# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable,
    :recoverable,
    :rememberable,
    :validatable,
    :confirmable,
    :invitable

  enum :platform_role, { regular: 0, super_admin: 1 }

  has_one :profile, dependent: :destroy
  has_many :forms, dependent: :destroy
  has_many :memberships, dependent: :destroy
  has_many :organizations, through: :memberships

  validates :first_name, presence: true
  validates :last_name, presence: true

  scope :ordered_by_name, -> { order(:last_name, :first_name) }
  scope :with_organizations_and_forms, -> { includes(:organizations, :forms, memberships: :organization) }
  scope :search, ->(term) { where("first_name ILIKE :q OR last_name ILIKE :q OR email ILIKE :q", q: "%#{term}%") }

  def administered_organization
    organizations.merge(Membership.admin).first
  end

  # An organization this user runs as an admin that the given user belongs to.
  def administered_organization_of(member_id)
    organizations.merge(Membership.admin).find_by(id: Membership.where(user_id: member_id).select(:organization_id))
  end
end
