class User < ApplicationRecord
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :validatable, :confirmable, :invitable

  enum :platform_role, { regular: 0, super_admin: 1 }

  has_one :profile, dependent: :destroy
  has_many :forms, dependent: :destroy
  has_many :memberships, dependent: :destroy
  has_many :organizations, through: :memberships

  validates :first_name, presence: true
  validates :last_name, presence: true
end
