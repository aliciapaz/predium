class CreateForms < ActiveRecord::Migration[8.1]
  def change
    create_table :forms do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :national_id
      t.date :date_of_birth
      t.string :phone
      t.integer :gender
      t.integer :work_force
      t.decimal :land_area, precision: 10, scale: 2
      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6
      t.string :country
      t.string :region
      t.string :locality
      t.text :system_types, array: true, default: []
      t.text :observations
      t.string :state, default: "draft"
      t.datetime :completed_at
      t.datetime :synchronized_at
      t.datetime :discarded_at
      t.string :territory_key

      t.timestamps
    end

    add_index :forms, :state
    add_index :forms, :discarded_at
    add_index :forms, [:country, :region]
    add_index :forms, :territory_key
    add_index :forms, :completed_at
  end
end
