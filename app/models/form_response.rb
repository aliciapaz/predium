# frozen_string_literal: true

class FormResponse < ApplicationRecord
  belongs_to :form

  before_validation :assign_extension_flag

  validates :indicator_key, presence: true, uniqueness: { scope: :form_id }
  validates :value, presence: true, numericality: { in: 1..10, only_integer: true }
  validate :indicator_key_in_questionnaire

  private

  # is_extension is a pure function of the key ("not a principle"), so callers
  # cannot set it inconsistently.
  def assign_extension_flag
    return if indicator_key.blank?

    self.is_extension = !QuestionnaireConfig.principle?(indicator_key)
  end

  def indicator_key_in_questionnaire
    return if indicator_key.blank?

    errors.add(:indicator_key, :not_in_questionnaire) unless QuestionnaireConfig.known_key?(indicator_key, form&.territory_key)
  end
end
