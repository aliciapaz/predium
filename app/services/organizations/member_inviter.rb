# frozen_string_literal: true

module Organizations
  # Adds a user to an organization, inviting them via Devise when they do
  # not yet have a confirmed account. Returns a status the controller maps
  # to a flash message.
  class MemberInviter
    include ActiveModel::Model

    Result = Data.define(:status)

    attr_accessor :organization, :email, :role, :invited_by

    def call
      normalize
      @user = User.find_by(email: email)
      return Result.new(:already_member) if confirmed_member?

      add_member
      Result.new(:invited)
    end

    private

    def normalize
      self.email = email&.downcase&.strip
      self.role = role.presence || "member"
    end

    def confirmed_member?
      @user&.confirmed? && member?(@user)
    end

    def add_member
      @user = invite_user unless @user&.confirmed?
      organization.memberships.create!(user: @user, role: role) unless member?(@user)
    end

    def invite_user
      User.invite!({ email: email, first_name: "Invited", last_name: "User" }, invited_by)
    end

    def member?(user)
      organization.memberships.exists?(user: user)
    end
  end
end
