# frozen_string_literal: true

require "rails_helper"

RSpec.describe(QuestionnaireConfig) do
  # Copy core + extensions into a tmpdir and point the loader at it, so examples
  # can add extension files and rewrite them without touching the real config.
  # reload! before and after guarantees each example reads the tmpdir YAML and
  # nothing memoized from it (or from the real files) leaks across examples.
  def with_copied_config
    Dir.mktmpdir do |dir|
      dir = Pathname.new(dir)
      extensions = dir.join("extensions")
      extensions.mkpath
      FileUtils.cp(Rails.root.join("config/questionnaire/core.yml"), dir.join("core.yml"))
      FileUtils.cp(Rails.root.join("config/questionnaire/extensions/chile.yml"), extensions.join("chile.yml"))

      stub_const("QuestionnaireConfig::CORE_PATH", dir.join("core.yml"))
      stub_const("QuestionnaireConfig::EXTENSIONS_DIR", extensions)
      described_class.reload!
      yield dir, extensions
    ensure
      described_class.reload!
    end
  end

  def write_extension(extensions, name, body)
    extensions.join("#{name}.yml").write(body.to_yaml)
  end

  describe "core loading" do
    it "loads six principles in position order with no level scaffold" do
      with_copied_config do
        keys = described_class.principles.map { |p| p[:key] }
        expect(keys).to(eq(["biodiversity", "recycling", "interactions", "soil_management", "pest_management", "traditional_knowledge"]))
        expect(described_class.principles).to(all(satisfy { |p| !p.key?(:level) }))
      end
    end

    it "exposes categories and dimensions without a level field" do
      with_copied_config do
        expect(described_class.l1_categories.size).to(eq(6))
        expect(described_class.dimensions.size).to(eq(14))
        expect(described_class.l1_categories).to(all(satisfy { |c| !c.key?(:level) }))
        expect(described_class.dimensions).to(all(include(:category)))
      end
    end
  end

  describe ".extension" do
    it "resolves the chile chain: 72 indicators tagged and dimension-valid" do
      with_copied_config do
        chile = described_class.extension("chile")
        expect(chile[:indicators].size).to(eq(72))
        expect(chile[:extends]).to(be_nil)
        expect(chile[:indicators]).to(all(include(extension: "chile")))
        dims = described_class.dimensions.map { |d| d[:key] }
        expect(chile[:indicators].map { |i| i[:dimension] }.uniq - dims).to(be_empty)
      end
    end

    it "resolves a child chain parent-first, each indicator tagged with its source" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "parent", {
          "territory" => "parent",
          "i18n_key" => "questionnaire.extensions.parent",
          "indicators" => [{ "key" => "p_one", "dimension" => "soil_health", "i18n_key" => "x.p_one", "position" => 1 }],
        })
        write_extension(extensions, "child", {
          "territory" => "child",
          "i18n_key" => "questionnaire.extensions.child",
          "extends" => "parent",
          "indicators" => [{ "key" => "c_one", "dimension" => "water_availability", "i18n_key" => "x.c_one", "position" => 1 }],
        })

        child = described_class.extension("child")
        expect(child[:extends]).to(eq("parent"))
        expect(child[:indicators].map { |i| [i[:key], i[:extension]] }).to(eq([["p_one", "parent"], ["c_one", "child"]]))
      end
    end

    it "resolves a three-level chain in order" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "a", {
          "territory" => "a",
          "i18n_key" => "x.a",
          "indicators" => [{ "key" => "a1", "dimension" => "soil_health", "i18n_key" => "x.a1", "position" => 1 }],
        })
        write_extension(extensions, "b", {
          "territory" => "b",
          "i18n_key" => "x.b",
          "extends" => "a",
          "indicators" => [{ "key" => "b1", "dimension" => "soil_health", "i18n_key" => "x.b1", "position" => 1 }],
        })
        write_extension(extensions, "c", {
          "territory" => "c",
          "i18n_key" => "x.c",
          "extends" => "b",
          "indicators" => [{ "key" => "c1", "dimension" => "soil_health", "i18n_key" => "x.c1", "position" => 1 }],
        })

        expect(described_class.extension("c")[:indicators].map { |i| i[:key] }).to(eq(["a1", "b1", "c1"]))
      end
    end

    it "raises on a cycle" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "x", {
          "territory" => "x",
          "i18n_key" => "x.x",
          "extends" => "y",
          "indicators" => [{ "key" => "x1", "dimension" => "soil_health", "i18n_key" => "x.x1", "position" => 1 }],
        })
        write_extension(extensions, "y", {
          "territory" => "y",
          "i18n_key" => "x.y",
          "extends" => "x",
          "indicators" => [{ "key" => "y1", "dimension" => "soil_health", "i18n_key" => "x.y1", "position" => 1 }],
        })

        expect { described_class.extension("x") }.to(raise_error(QuestionnaireConfig::Error, /Cycle/))
      end
    end

    it "raises on an unknown parent" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "orphan", {
          "territory" => "orphan",
          "i18n_key" => "x.orphan",
          "extends" => "ghost",
          "indicators" => [{ "key" => "o1", "dimension" => "soil_health", "i18n_key" => "x.o1", "position" => 1 }],
        })

        expect { described_class.extension("orphan") }.to(raise_error(QuestionnaireConfig::Error, /not found/))
      end
    end

    it "raises when a key is declared in two extension files" do
      with_copied_config do |_dir, extensions|
        ["dup_a", "dup_b"].each do |name|
          write_extension(extensions, name, {
            "territory" => name,
            "i18n_key" => "x.#{name}",
            "indicators" => [{ "key" => "shared_key", "dimension" => "soil_health", "i18n_key" => "x.s", "position" => 1 }],
          })
        end

        expect { described_class.extension("dup_a") }.to(raise_error(QuestionnaireConfig::Error, /declared more than once/))
      end
    end

    it "raises when an indicator key collides with a principle key" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "clash", {
          "territory" => "clash",
          "i18n_key" => "x.clash",
          "indicators" => [{ "key" => "biodiversity", "dimension" => "soil_health", "i18n_key" => "x.b", "position" => 1 }],
        })

        expect { described_class.extension("clash") }.to(raise_error(QuestionnaireConfig::Error, /declared more than once/))
      end
    end

    it "raises on an indicator naming an unknown dimension" do
      with_copied_config do |_dir, extensions|
        write_extension(extensions, "baddim", {
          "territory" => "baddim",
          "i18n_key" => "x.baddim",
          "indicators" => [{ "key" => "bd1", "dimension" => "no_such_dimension", "i18n_key" => "x.bd1", "position" => 1 }],
        })

        expect { described_class.extension("baddim") }.to(raise_error(QuestionnaireConfig::Error, /Unknown dimension/))
      end
    end
  end

  describe "key lookups" do
    it "answers known_key? by principle and by resolved chain" do
      with_copied_config do
        expect(described_class.known_key?("biodiversity", nil)).to(be(true))
        expect(described_class.known_key?("soil_coverage", "chile")).to(be(true))
        expect(described_class.known_key?("soil_coverage", nil)).to(be(false))
        expect(described_class.known_key?("soil_coverage", "elsewhere")).to(be(false))
        expect(described_class.known_key?("totally_bogus", "chile")).to(be(false))
      end
    end

    it "returns no indicator keys for blank or unknown territory without raising" do
      with_copied_config do
        expect(described_class.extension_indicator_keys(nil)).to(eq([]))
        expect(described_class.extension_indicator_keys("")).to(eq([]))
        expect(described_class.extension_indicator_keys("elsewhere")).to(eq([]))
      end
    end

    it "keeps principle keys and indicator keys disjoint" do
      with_copied_config do
        expect(described_class.principle_keys & described_class.all_indicator_keys).to(be_empty)
      end
    end
  end

  describe "locale coverage" do
    let(:es) { YAML.load_file(Rails.root.join("config/locales/es/questionnaire.yml")).dig("es", "questionnaire") }
    let(:en) { YAML.load_file(Rails.root.join("config/locales/en/questionnaire.yml")).dig("en", "questionnaire") }

    it "has a name for every principle in both locales" do
      with_copied_config do
        described_class.principle_keys.each do |key|
          expect(es.dig("principles", key, "name")).to(be_present, "es principle #{key}")
          expect(en.dig("principles", key, "name")).to(be_present, "en principle #{key}")
        end
      end
    end

    it "has a name for every chile indicator in both locales" do
      with_copied_config do
        described_class.extension("chile")[:indicators].each do |ind|
          expect(es.dig("indicators", ind[:key], "name")).to(be_present, "es indicator #{ind[:key]}")
          expect(en.dig("indicators", ind[:key], "name")).to(be_present, "en indicator #{ind[:key]}")
        end
      end
    end
  end

  describe ".extension_keys" do
    it "lists the available territory extensions" do
      expect(described_class.extension_keys).to(include("chile"))
    end
  end

  describe ".fingerprint" do
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
end
