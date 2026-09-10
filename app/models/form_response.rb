# frozen_string_literal: true

class FormResponse < ApplicationRecord
  belongs_to :form

  validates :indicator_key, presence: true, uniqueness: { scope: :form_id }
  validates :value, presence: true, numericality: { in: 1..10, only_integer: true }
  validate :indicator_key_in_questionnaire

  scope :core, -> { where(is_extension: false) }
  scope :territory_extensions, -> { where(is_extension: true) }

  class << self
    def core_indicator_keys
      core.pluck(:indicator_key)
    end
  end

  private

  def indicator_key_in_questionnaire
    return if indicator_key.blank? || is_extension?

    errors.add(:indicator_key, :not_in_questionnaire) unless QuestionnaireConfig.core_indicator?(indicator_key)
  end
end
