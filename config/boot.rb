# frozen_string_literal: true

ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup" # Set up gems listed in the Gemfile.
# Bootsnap's iseq cache conflicts with SimpleCov's branch coverage in test.
require "bootsnap/setup" unless ENV["RAILS_ENV"] == "test"
