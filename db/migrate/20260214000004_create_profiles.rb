class CreateProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :phone
      t.string :role_name
      t.string :country
      t.string :region
      t.string :locality

      t.timestamps
    end
  end
end
