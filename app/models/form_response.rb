class FormResponse < ApplicationRecord
  belongs_to :form

  validates :indicator_key, presence: true, uniqueness: { scope: :form_id }
  validates :value, presence: true, numericality: { in: 1..10, only_integer: true }

  scope :core, -> { where(is_extension: false) }
  scope :territory_extensions, -> { where(is_extension: true) }
end
