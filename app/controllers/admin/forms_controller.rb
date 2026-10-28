# frozen_string_literal: true

module Admin
  class FormsController < Admin::BaseController
    def show
      @form = Form.with_responses.find_by!(client_id: params[:id])
      @embedded_form = Forms::Serializer.new(@form).call
      @back_path = url_from(request.referer) || admin_root_path
    end
  end
end
