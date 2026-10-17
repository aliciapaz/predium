# frozen_string_literal: true

require "monitor"

# Loads and caches the YAML questionnaire configuration.
# Level 1 is the six agroecology principles (answered directly); Level 2 is the
# categories/dimensions structure, with indicators supplied by territory
# extensions that may `extends` one another.
#
# Thread-safe singleton. A reentrant Monitor (not Mutex) guards loading because
# extension chain resolution recurses into `extension` (for the parent) and into
# `load_core!` (to validate dimensions) while already holding the lock.
#
# See docs/architecture.md ADR-2.
class QuestionnaireConfig
  class Error < StandardError; end

  CORE_PATH = Rails.root.join("config/questionnaire/core.yml").freeze
  EXTENSIONS_DIR = Rails.root.join("config/questionnaire/extensions").freeze
  MONITOR = Monitor.new

  class << self
    def principles
      load_core!
      @principles
    end

    def principle_keys
      principles.map { |p| p[:key] }
    end

    def principle?(key)
      load_core!
      @principles_by_key.key?(key.to_s)
    end

    def dimensions
      load_core!
      @dimensions
    end

    def l1_categories
      load_core!
      @l1_categories
    end

    def dimension?(key)
      load_core!
      @dimensions_by_key.key?(key.to_s)
    end

    def extension(territory_key)
      MONITOR.synchronize do
        @extensions ||= {}
        @extensions[territory_key.to_s] ||= resolve_extension(territory_key.to_s, [])
      end
    end

    def extension_keys
      EXTENSIONS_DIR.glob("*.yml").map { |path| path.basename(".yml").to_s }.sort
    end

    # Resolved indicator objects for a form's territory chain. Blank or unknown
    # territory degrades to none rather than raising.
    def extension_indicators(territory_key)
      key = territory_key.to_s
      return [] if key.empty? || extension_keys.exclude?(key)

      extension(key)[:indicators]
    end

    def extension_indicator_keys(territory_key)
      extension_indicators(territory_key).map { |i| i[:key] }
    end

    # Every key a form of this territory may hold: principles plus its chain.
    def known_indicator_keys(territory_key)
      principle_keys + extension_indicator_keys(territory_key)
    end

    # A response key is allowed for a form when it is a principle or belongs to
    # the form's resolved territory chain.
    def known_key?(key, territory_key)
      principle?(key) || extension_indicator_keys(territory_key).include?(key.to_s)
    end

    # Every indicator key across all extension files (for the API permit list),
    # via the cached, uniqueness-guarded resolver. Global uniqueness keeps it flat.
    def all_indicator_keys
      extension_keys.flat_map { |key| extension(key)[:indicators].map { |i| i[:key] } }.uniq
    end

    def fingerprint
      files = [CORE_PATH] + EXTENSIONS_DIR.glob("*.yml").sort + questionnaire_locale_files
      Digest::SHA256.hexdigest(files.map(&:read).join("\x1e"))
    end

    def reload!
      MONITOR.synchronize do
        @loaded = false
        @extensions = {}
        @principles = nil
        @principles_by_key = nil
        @dimensions = nil
        @dimensions_by_key = nil
        @l1_categories = nil
      end
    end

    private

    def questionnaire_locale_files
      Rails.root.glob("config/locales/*/questionnaire.yml").sort
    end

    def load_core!
      return if @loaded

      MONITOR.synchronize do
        return if @loaded

        raw = YAML.load_file(CORE_PATH)
        build_principles(raw.fetch("principles"))
        build_structure(raw.fetch("categories"))

        @loaded = true
      end
    end

    def build_principles(principles)
      @principles = principles.map do |p|
        { key: p.fetch("key"), i18n_key: p.fetch("i18n_key"), position: p.fetch("position") }
      end
      @principles_by_key = @principles.index_by { |p| p[:key] }
    end

    def build_structure(categories)
      @l1_categories = []
      @dimensions = []

      categories.each do |cat|
        category = build_category(cat)
        @l1_categories << category

        cat.fetch("dimensions").each do |dim|
          @dimensions << build_dimension(dim, category[:key])
        end
      end

      @dimensions_by_key = @dimensions.index_by { |d| d[:key] }
    end

    def resolve_extension(territory_key, visiting)
      path = EXTENSIONS_DIR.join("#{territory_key}.yml")
      raise Error, "Extension not found: #{territory_key} (expected #{path})" unless path.exist?
      raise Error, "Cycle in extends chain: #{(visiting + [territory_key]).join(" -> ")}" if visiting.include?(territory_key)

      raw = YAML.load_file(path)
      indicators = parent_indicators(raw["extends"], visiting + [territory_key]) +
        own_indicators(raw.fetch("indicators"), territory_key)
      guard_chain!(territory_key, indicators)

      { territory: raw.fetch("territory"), i18n_key: raw.fetch("i18n_key"), extends: raw["extends"], indicators: indicators }
    end

    def parent_indicators(parent_key, visiting)
      return [] if parent_key.nil?

      resolve_extension(parent_key.to_s, visiting)[:indicators]
    end

    def own_indicators(raw_indicators, territory_key)
      guard_global_uniqueness!
      raw_indicators.map { |ind| build_extension_indicator(ind, territory_key) }
    end

    def guard_chain!(territory_key, indicators)
      indicators.each do |ind|
        raise Error, "Unknown dimension: #{ind[:dimension]} (#{ind[:key]})" unless dimension?(ind[:dimension])
      end
      duplicates = indicators.map { |i| i[:key] }.tally.select { |_, n| n > 1 }.keys
      raise Error, "Duplicate key in #{territory_key} chain: #{duplicates.join(", ")}" if duplicates.any?
    end

    # A key declared in more than one extension file, or an indicator key that
    # collides with a principle key, shares the locale namespace and the union
    # permit list and would be classified as both levels, so keys are globally
    # unique across principles and all extension indicators.
    def guard_global_uniqueness!
      keys = principle_keys + extension_keys.flat_map { |key| own_indicator_keys(key) }
      duplicates = keys.tally.select { |_, n| n > 1 }.keys
      raise Error, "Keys declared more than once (principles/indicators): #{duplicates.join(", ")}" if duplicates.any?
    end

    def own_indicator_keys(territory_key)
      path = EXTENSIONS_DIR.join("#{territory_key}.yml")
      YAML.load_file(path).fetch("indicators").map { |i| i.fetch("key") }
    end

    def build_category(cat)
      { key: cat.fetch("key"), i18n_key: cat.fetch("i18n_key"), position: cat.fetch("position") }
    end

    def build_dimension(dim, category_key)
      { key: dim.fetch("key"), i18n_key: dim.fetch("i18n_key"), category: category_key }
    end

    def build_extension_indicator(ind, territory_key)
      {
        key: ind.fetch("key"),
        dimension: ind.fetch("dimension"),
        i18n_key: ind.fetch("i18n_key"),
        position: ind.fetch("position"),
        extension: territory_key,
      }
    end
  end
end
