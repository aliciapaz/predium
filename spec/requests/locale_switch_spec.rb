# frozen_string_literal: true

require "rails_helper"

RSpec.describe("Language switch", type: :request) do
  before { sign_in create(:user, locale: "es") }

  # Turbo's cached snapshots share the live <html>, so a Back visit after a
  # Turbo-driven switch would restore one language's page under the other's lang.
  it "reloads the full document instead of making a Turbo visit" do
    get root_path

    switch = Nokogiri::HTML(response.body).css('[role="group"] a[lang]')
    expect(switch.map { |link| link["data-turbo"] }.uniq).to(eq(["false"]))
  end
end
