class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      # Devise: database_authenticatable
      t.string :email, null: false
      t.string :encrypted_password, null: false

      # User fields
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :locale, default: "en"
      t.integer :platform_role, default: 0

      # Devise: recoverable
      t.string :reset_password_token
      t.datetime :reset_password_sent_at

      # Devise: rememberable
      t.datetime :remember_created_at

      # Devise: confirmable
      t.string :confirmation_token
      t.datetime :confirmed_at
      t.datetime :confirmation_sent_at

      # devise_invitable
      t.string :invitation_token
      t.datetime :invitation_created_at
      t.datetime :invitation_sent_at
      t.datetime :invitation_accepted_at
      t.integer :invitation_limit
      t.integer :invitations_count, default: 0
      t.string :invited_by_type
      t.bigint :invited_by_id

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :reset_password_token, unique: true
    add_index :users, :confirmation_token, unique: true
    add_index :users, :invitation_token, unique: true
    add_index :users, :platform_role
  end
end
