# frozen_string_literal: true

module Organizations
  # Adds a user to an organization, inviting them via Devise when they do
  # not yet have a confirmed account. Returns a status the controller maps
  # to a flash message.
  class MemberInviter
    include ActiveModel::Model

    Result = Data.define(:status)

    DELIVERY_ERRORS = [
      Net::SMTPError, Timeout::Error, OpenSSL::SSL::SSLError, SocketError, SystemCallError, IOError,
    ].freeze

    attr_accessor :organization, :email, :role, :invited_by

    def call
      normalize
      @user = User.find_by(email: email)
      return Result.new(:already_member) if confirmed_member?

      add_member
      Result.new(send_invitation)
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
      @invitation_needed = !@user&.confirmed?
      @user = invite_user if @invitation_needed
      organization.memberships.create!(user: @user, role: role) unless member?(@user)
    end

    def invite_user
      User.invite!({ email: email, first_name: "Invited", last_name: "User" }, invited_by) do |user|
        user.skip_invitation = true
      end
    end

    # Sent after the membership exists, so a mail failure leaves the member listed and a re-invite resends it.
    def send_invitation
      @user.deliver_invitation if @invitation_needed
      :invited
    rescue *DELIVERY_ERRORS => error
      Rails.logger.error("Invitation email to #{@user.id} failed: #{error.class}: #{error.message}")
      :invitation_not_sent
    end

    def member?(user)
      organization.memberships.exists?(user: user)
    end
  end
end
