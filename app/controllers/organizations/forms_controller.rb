# frozen_string_literal: true

module Organizations
  class FormsController < ApplicationController
    include FormsExport

    before_action :authenticate_user!
    before_action :set_organization
    before_action :authorize_org_access
    before_action :authorize_export, unless: -> { request.format.html? }

    def index
      respond_to do |format|
        format.html do
          @forms = filtered(visible_forms)
          @export_count = visible_forms.count if allowed_to?(:manage?, @organization)
        end
        format.any(:csv, :xlsx) { send_forms_export(visible_forms, "predium-#{@organization.name.parameterize}") }
      end
    end

    private

    def visible_forms
      forms = Form.for_organization(@organization).with_user.recently_updated
      current_user.super_admin? ? forms : forms.made_after_joining
    end

    def filtered(forms)
      forms = forms.with_state(params[:state]) if params[:state].present?
      forms = forms.name_matches(params[:search]) if params[:search].present?
      forms
    end

    def set_organization
      @organization = Organization.find(params[:organization_id])
    end

    def authorize_org_access
      unless allowed_to?(:show?, @organization)
        redirect_to(root_path, alert: t("flash.unauthorized"))
      end
    end

    # Members see the list, but only those who run the organization may take
    # every member's answers away in a file.
    def authorize_export
      unless allowed_to?(:manage?, @organization)
        redirect_to(organization_forms_path(@organization), alert: t("flash.unauthorized"))
      end
    end
  end
end
