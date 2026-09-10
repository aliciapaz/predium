# frozen_string_literal: true

require "rails_helper"

RSpec.describe(QuestionnaireConfig) do
  describe ".fingerprint" do
    def with_copied_config
      Dir.mktmpdir do |dir|
        dir = Pathname.new(dir)
        extensions = dir.join("extensions")
        extensions.mkpath
        FileUtils.cp(Rails.root.join("config/questionnaire/core.yml"), dir.join("core.yml"))
        FileUtils.cp(Rails.root.join("config/questionnaire/extensions/chile.yml"), extensions.join("chile.yml"))

        stub_const("QuestionnaireConfig::CORE_PATH", dir.join("core.yml"))
        stub_const("QuestionnaireConfig::EXTENSIONS_DIR", extensions)
        yield dir
      end
    end

    it "changes when a questionnaire YAML file's content changes" do
      with_copied_config do |dir|
        original = described_class.fingerprint

        dir.join("extensions/chile.yml").open("a") { |f| f.puts "# changed" }

        expect(described_class.fingerprint).not_to(eq(original))
      end
    end

    it "is stable when nothing changes" do
      with_copied_config do
        expect(described_class.fingerprint).to(eq(described_class.fingerprint))
      end
    end
  end

  describe ".extension_keys" do
    it "lists the available territory extensions" do
      expect(described_class.extension_keys).to(include("chile"))
    end
  end
end
