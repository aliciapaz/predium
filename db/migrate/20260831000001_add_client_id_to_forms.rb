# frozen_string_literal: true

class AddClientIdToForms < ActiveRecord::Migration[8.1]
  def up
    add_column(:forms, :client_id, :string)
    execute("UPDATE forms SET client_id = gen_random_uuid() WHERE client_id IS NULL")
    change_column_null(:forms, :client_id, false)
    add_index(:forms, :client_id, unique: true)
  end

  def down
    remove_column(:forms, :client_id)
  end
end
