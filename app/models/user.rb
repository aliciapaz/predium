# frozen_string_literal: true

class User < ApplicationRecord
  devise :database_authenticatable,
    :registerable,
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
  scope :with_organizations_and_forms, -> { includes(:organizations, :forms) }
  scope :search, ->(term) { where("first_name ILIKE :q OR last_name ILIKE :q OR email ILIKE :q", q: "%#{term}%") }
end
