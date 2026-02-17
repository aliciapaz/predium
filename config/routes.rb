Rails.application.routes.draw do
  devise_for :users, controllers: {
    invitations: "users/invitations"
  }

  root "forms#index"

  resource :profile, only: [:show, :edit, :update]

  resources :forms do
    resource :completion, only: [:create], controller: "forms/completions"
    resources :questionnaire_steps, only: [:show, :update], controller: "forms/questionnaire_steps"
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

  get "translations/:locale", to: "translations#show", as: :translations

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  get "up" => "rails/health#show", as: :rails_health_check
end
