# frozen_string_literal: true

Rails.application.routes.draw do
  devise_for :users, controllers: {
    invitations: "users/invitations",
  }

  root "forms#index"

  resource :profile, only: [:show, :edit, :update]

  resources :forms, only: [:index, :show, :new, :edit, :destroy] do
    resource :completion, only: [:create], controller: "forms/completions"
  end

  resources :organizations, only: [:show] do
    resources :forms, only: [:index], controller: "organizations/forms"
    resources :invitations, only: [:new, :create], controller: "organizations/invitations"
    resources :memberships, only: [:index, :destroy], controller: "organizations/memberships"
  end

  namespace :admin do
    root "dashboard#show"
    resources :organizations
    resources :users, only: [:index, :show, :edit, :update]
  end

  namespace :api, defaults: { format: :json } do
    resource :questionnaire, only: [:show]
    resources :forms, only: [:index, :update], param: :client_id
  end

  get "translations/:locale", to: "translations#show", as: :translations

  get "service-worker", to: "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest", to: "rails/pwa#manifest", as: :pwa_manifest

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  get "up" => "rails/health#show", as: :rails_health_check
end
