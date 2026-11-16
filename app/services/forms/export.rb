# frozen_string_literal: true

require "csv"

module Forms
  # Writes a forms export table out as a CSV or Excel file.
  class Export
    # A text cell opening with one of these runs as a formula when the CSV is
    # opened in a spreadsheet. caxlsx already escapes them in the xlsx.
    FORMULA_PREFIX = /\A[=+\-@\t\r]/

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
        table.each { |row| sheet.add_row(row) }
      end
      package.to_stream.read
    end

    def neutralize_formula(value)
      value.is_a?(String) && value.match?(FORMULA_PREFIX) ? "'#{value}" : value
    end

    def table
      ExportTable.new(forms).call
    end
  end
end
