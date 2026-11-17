# frozen_string_literal: true

require "csv"

module Forms
  # Writes a forms export table out as a CSV or Excel file.
  class Export
    # A text cell opening with one of these runs as a formula when the CSV is
    # opened in a spreadsheet. caxlsx already escapes them in the xlsx.
    FORMULA_PREFIX = /\A[=+\-@\t\r]/
    # One leading sign over digits and phone punctuation cannot call a function,
    # reference a cell or do arithmetic, so phones like "+56 9 1234 5678" are
    # left as typed. A second + or - would be computed, so it stays quoted.
    PLAIN_NUMBER = /\A[+-]?[\d\s().]*\z/

    def initialize(forms, format:)
      @forms = forms
      @format = format
    end

    def call
      format == :xlsx ? xlsx : csv
    end

    private

    attr_reader :forms, :format

    def csv
      CSV.generate do |file|
        table.each { |row| file << row.map { |value| neutralize_formula(value) } }
      end
    end

    def xlsx
      package = Axlsx::Package.new
      package.workbook.add_worksheet(name: I18n.t("navigation.forms")) do |sheet|
        table.each { |row| sheet.add_row(row, types: cell_types(row)) }
      end
      package.to_stream.read
    end

    # caxlsx turns any numeric-looking text into a number, so an ID like
    # "001234" would lose its zeros. Only real numbers are left to it.
    def cell_types(row)
      row.map { |value| :string unless value.is_a?(Numeric) }
    end

    def neutralize_formula(value)
      formula_like?(value) ? "'#{value}" : value
    end

    def formula_like?(value)
      value.is_a?(String) && value.match?(FORMULA_PREFIX) && !value.match?(PLAIN_NUMBER)
    end

    def table
      ExportTable.new(forms).call
    end
  end
end
