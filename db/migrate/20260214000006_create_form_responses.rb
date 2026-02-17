class CreateFormResponses < ActiveRecord::Migration[8.1]
  def change
    create_table :form_responses do |t|
      t.references :form, null: false, foreign_key: true
      t.string :indicator_key, null: false
      t.integer :value, null: false
      t.boolean :is_extension, default: false

      t.timestamps
    end

    add_index :form_responses, [:form_id, :indicator_key], unique: true
    add_index :form_responses, :indicator_key
    add_index :form_responses, :is_extension
  end
end
