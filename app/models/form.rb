class Form < ApplicationRecord
  include AASM
  include Discard::Model

  belongs_to :user
  has_many :form_responses, dependent: :destroy
  has_one_attached :photo
  has_one_attached :pdf

  enum :gender, { not_specified: 0, male: 1, female: 2, other: 3 }

  validates :name, presence: true
  validates :land_area, numericality: { greater_than: 0 }, allow_nil: true

  default_scope -> { kept }

  scope :completed, -> { where(state: "completed") }
  scope :draft, -> { where(state: "draft") }
  scope :by_country, ->(country) { where(country: country) }

  aasm column: :state do
    state :draft, initial: true
    state :completed

    event :complete do
      before { self.completed_at = Time.current }

      transitions from: :draft, to: :completed
    end
  end
end
