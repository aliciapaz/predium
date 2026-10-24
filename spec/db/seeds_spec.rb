# frozen_string_literal: true

require "rails_helper"

RSpec.describe("db/seeds.rb") do
  let(:seeds) { Rails.root.join("db/seeds.rb") }

  it "creates no records in production" do
    allow(Rails).to(receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production")))

    expect { load(seeds) }.not_to(change(User, :count))
  end

  it "creates the demo accounts outside production" do
    expect { load(seeds) }.to(output(/Seeding/).to_stdout)
    expect(User.exists?(email: "admin@predium.cl")).to(be(true))
  end
end
