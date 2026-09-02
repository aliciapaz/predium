# frozen_string_literal: true

class FormsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_form, only: [:show, :edit]
  before_action :ensure_draft, only: [:edit]

  def index
    forms = current_user.forms.order(updated_at: :desc)
    @drafts = forms.draft
    @completed = forms.completed
  end

  # Results shell: scores hydrate client-side from IndexedDB (KTD-4 in the
  # offline-first plan), so the form may not exist server-side yet when it
  # was created offline and has not synced.
  def show
    redirect_to(edit_form_path(@form)) if @form&.draft?
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

  def ensure_draft
    redirect_to(form_path(@form), alert: t("flash.form_locked")) if @form&.completed?
  end
end
