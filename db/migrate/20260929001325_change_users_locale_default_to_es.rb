# frozen_string_literal: true

class ChangeUsersLocaleDefaultToEs < ActiveRecord::Migration[8.1]
  def change
    change_column_default(:users, :locale, from: "en", to: "es")
  end
end
