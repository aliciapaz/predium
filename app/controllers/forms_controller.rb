class FormsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_form, only: [:show, :edit, :update, :destroy]

  def index
    forms = current_user.forms.order(updated_at: :desc)
    @drafts = forms.draft
    @completed = forms.completed
  end

  def show
    if @form.draft?
      redirect_to edit_form_path(@form)
      return
    end

    @calculator = Scoring::Calculator.new(@form).call
  end

  def new
    @form = current_user.forms.build
  end

  def create
    @form = current_user.forms.build(form_params)

    if @form.save
      first_dimension = QuestionnaireConfig.dimensions.first
      redirect_to form_questionnaire_step_path(@form, first_dimension[:key]),
                  notice: t("flash.form_created")
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @form.update(form_params)
      redirect_to edit_form_path(@form), notice: t("flash.form_updated")
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @form.discard
    redirect_to forms_path, notice: t("flash.form_deleted")
  end

  private

  def set_form
    @form = current_user.forms.find(params[:id])
  end

  def form_params
    params.expect(form: [
      :name, :national_id, :date_of_birth, :phone, :gender,
      :work_force, :land_area, :latitude, :longitude,
      :country, :region, :locality, :observations, :territory_key,
      system_types: []
    ])
  end
end
