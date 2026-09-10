# frozen_string_literal: true

class Form < ApplicationRecord
  include AASM
  include Discard::Model

  belongs_to :user
  has_many :form_responses, dependent: :destroy
  has_one_attached :photo
  has_one_attached :pdf

  enum :gender, { not_specified: 0, male: 1, female: 2, other: 3 }

  before_validation :ensure_client_id, on: :create

  validates :name, presence: true
  validates :client_id, presence: true, uniqueness: true
  validates :land_area, numericality: { greater_than: 0 }, allow_nil: true

  default_scope -> { kept }

  scope :completed, -> { where(state: "completed") }
  scope :draft, -> { where(state: "draft") }
  scope :by_country, ->(country) { where(country: country) }
  scope :with_state, ->(state) { where(state: state) }
  scope :recently_updated, -> { order(updated_at: :desc) }
  scope :with_user, -> { includes(:user) }
  scope :with_responses, -> { includes(:form_responses) }
  scope :for_user_ids, ->(ids) { where(user_id: ids) }
  scope :completed_on_or_after, ->(time) { where(completed_at: time..) }
  scope :completed_on_or_before, ->(time) { where(completed_at: ..time) }
  scope :name_matches, ->(term) { where("forms.name ILIKE ?", "%#{sanitize_sql_like(term)}%") }
  scope :for_organization, ->(organization) { joins(user: :memberships).where(memberships: { organization_id: organization.id }) }
  scope :recent_completed, ->(limit) { completed.with_user.order(completed_at: :desc).limit(limit) }
  scope :recent, ->(limit) { order(created_at: :desc).limit(limit) }

  class << self
    def countries
      distinct.where.not(country: [nil, ""]).pluck(:country).sort
    end
  end

  aasm column: :state do
    state :draft, initial: true
    state :completed

    event :complete do
      before { self.completed_at = Time.current }

      transitions from: :draft, to: :completed
    end
  end

  def to_param
    client_id
  end

  private

  def ensure_client_id
    self.client_id ||= SecureRandom.uuid
  end
end
