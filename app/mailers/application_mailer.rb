# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  default from: "Predium <hola@prediumapp.org>"
  layout "mailer"
end
