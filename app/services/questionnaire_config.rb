# frozen_string_literal: true

# Loads and caches the YAML questionnaire configuration.
# Thread-safe singleton that provides lookup methods for
# categories, dimensions, and indicators.
#
# See docs/architecture.md ADR-2.
class QuestionnaireConfig
  class Error < StandardError; end

  CORE_PATH = Rails.root.join("config/questionnaire/core.yml").freeze
  EXTENSIONS_DIR = Rails.root.join("config/questionnaire/extensions").freeze
  MUTEX = Mutex.new

  class << self
    def core_indicators
      load_core!
      @core_indicators
    end

    def dimensions
      load_core!
      @dimensions
    end

    def l1_categories
      load_core!
      @l1_categories
    end

    def indicator(key)
      load_core!
      @indicators_by_key[key.to_s] || raise(Error, "Unknown indicator: #{key}")
    end

    def extension(territory_key)
      MUTEX.synchronize do
        @extensions ||= {}
        @extensions[territory_key.to_s] ||= load_extension!(territory_key)
      end
    end

    def reload!
      MUTEX.synchronize do
        @loaded = false
        @extensions = {}
        @core_indicators = nil
        @dimensions = nil
        @l1_categories = nil
        @indicators_by_key = nil
      end
    end

    private

    def load_core!
      return if @loaded

      MUTEX.synchronize do
        return if @loaded

        raw = YAML.load_file(CORE_PATH)
        categories = raw.fetch("categories")

        @l1_categories = []
        @dimensions = []
        @core_indicators = []
        @indicators_by_key = {}

        categories.each do |cat|
          category = build_category(cat)
          @l1_categories << category

          cat.fetch("dimensions").each do |dim|
            dimension = build_dimension(dim, category[:key])
            @dimensions << dimension

            dim.fetch("indicators").each do |ind|
              indicator = build_indicator(ind, dimension[:key], category[:key])
              @core_indicators << indicator
              @indicators_by_key[indicator[:key]] = indicator
            end
          end
        end

        @loaded = true
      end
    end

    def load_extension!(territory_key)
      path = EXTENSIONS_DIR.join("#{territory_key}.yml")
      raise Error, "Extension not found: #{territory_key} (expected #{path})" unless path.exist?

      raw = YAML.load_file(path)
      indicators = raw.fetch("indicators").map do |ind|
        {
          key: ind.fetch("key"),
          dimension: ind.fetch("dimension"),
          i18n_key: ind.fetch("i18n_key"),
          level: ind.fetch("level"),
          position: ind.fetch("position"),
          extension: territory_key.to_s
        }
      end

      {
        territory: raw.fetch("territory"),
        i18n_key: raw.fetch("i18n_key"),
        indicators: indicators
      }
    end

    def build_category(cat)
      {
        key: cat.fetch("key"),
        i18n_key: cat.fetch("i18n_key"),
        level: cat.fetch("level"),
        position: cat.fetch("position")
      }
    end

    def build_dimension(dim, category_key)
      {
        key: dim.fetch("key"),
        i18n_key: dim.fetch("i18n_key"),
        category: category_key
      }
    end

    def build_indicator(ind, dimension_key, category_key)
      {
        key: ind.fetch("key"),
        i18n_key: ind.fetch("i18n_key"),
        level: ind.fetch("level"),
        position: ind.fetch("position"),
        dimension: dimension_key,
        category: category_key
      }
    end
  end
end
