# frozen_string_literal: true

module Admin
  class DashboardController < Admin::BaseController
    def show
      @report = Admin::DashboardReport.new(
        country: params[:country],
        date_from: params[:date_from],
        date_to: params[:date_to],
      ).call
    end
  end
end
