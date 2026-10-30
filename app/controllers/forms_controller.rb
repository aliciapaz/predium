# frozen_string_literal: true

class FormsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_form, only: [:edit]
  before_action :ensure_draft, only: [:edit]

  def index
    forms = current_user.forms.recently_updated
    @drafts = forms.draft
    @completed = forms.completed
  end

  # Results shell: the owner's scores hydrate client-side from IndexedDB
  # (KTD-4 in the offline-first plan), so the form may not exist server-side
  # yet when it was created offline and has not synced. Drafts show partial
  # results. Someone else's form is embedded instead, online only:
  # seedFromServer prunes any local form missing from the viewer's own list,
  # so it cannot live in their IndexedDB.
  def show
    show_shared_form unless current_user.forms.exists?(client_id: params[:id])
  end

  def new
  end

  def edit
  end

  def destroy
    form = current_user.forms.find_by!(client_id: params[:id])
    form.discard
    redirect_to(forms_path, notice: t("flash.form_deleted"))
  end

  private

  def set_form
    @form = current_user.forms.find_by(client_id: params[:id])
  end

  def show_shared_form
    form = Form.with_responses.find_by(client_id: params[:id])
    return unless form
    return redirect_to(root_path, alert: t("flash.unauthorized")) unless allowed_to?(:show?, form)

    @embedded_form = Forms::Serializer.new(form).call
    @back_path = shared_form_back_path(form)
  end

  def shared_form_back_path(form)
    organization = current_user.administered_organization_for(form)
    return organization_forms_path(organization) if organization

    url_from(request.referer) || root_path
  end

  def ensure_draft
    redirect_to(form_path(@form), alert: t("flash.form_locked")) if @form&.completed?
  end
end
