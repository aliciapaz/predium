# frozen_string_literal: true

require "rails_helper"

RSpec.describe(Forms::Export) do
  let(:user) { create(:user, first_name: "Luis", last_name: "Soto", email: "luis@example.com") }

  # Maps each cell's text to its cell type ("inlineStr" text, "n" number).
  def xlsx_cells(xlsx)
    sheet = Zip::File.open_buffer(StringIO.new(xlsx)).read("xl/worksheets/sheet1.xml")
    Nokogiri::XML(sheet).remove_namespaces!.xpath("//c").to_h do |cell|
      [cell.at("t")&.text || cell.at("v")&.text, cell["t"] || "n"]
    end
  end

  def csv_rows(forms = Form.all)
    CSV.parse(described_class.new(forms, format: :csv).call, headers: true)
  end

  it "writes one row per form with the farm, its author and its state in words" do
    create(:form, user: user, name: "La Esperanza", gender: :female, system_types: ["agriculture", "livestock"],
      land_area: 12.5, latitude: -33.45, territory_key: "chile")

    row = csv_rows.first

    expect(row["Nombre del predio"]).to(eq("La Esperanza"))
    expect(row["Creado por"]).to(eq("Luis Soto"))
    expect(row["Correo electrónico"]).to(eq("luis@example.com"))
    expect(row["Estado"]).to(eq("Borrador"))
    expect(row["Género"]).to(eq("Femenino"))
    expect(row["Tipos de sistema"]).to(eq("Agricultura, Ganadería"))
    expect(row["Superficie (hectáreas)"]).to(eq("12.5"))
    expect(row["Latitud"]).to(eq("-33.45"))
    expect(row["Territorio"]).to(eq("Chile"))
  end

  it "writes every answer and the scores the results page shows" do
    form = create(:form, user: user, territory_key: "chile")
    create(:form_response, form: form, indicator_key: "biodiversity", value: 7)
    create(:form_response, form: form, indicator_key: "soil_coverage", value: 6)
    create(:form_response, form: form, indicator_key: "soil_erosion", value: 9)

    row = csv_rows.first

    expect(row["Principio: Biodiversidad"]).to(eq("7"))
    expect(row["Principio: Reciclaje"]).to(be_nil)
    expect(row["Indicador: Cobertura de suelo"]).to(eq("6"))
    expect(row["Dimensión: Calidad de suelo"]).to(eq("7.5"))
    expect(row["Puntaje general"]).to(eq("7.5"))
  end

  it "leaves an unscored dimension blank rather than zero" do
    create(:form, user: user, territory_key: nil)

    expect(csv_rows.first["Dimensión: Calidad de suelo"]).to(be_nil)
  end

  it "has a column for every principle, dimension and indicator, whatever the forms hold" do
    headers = CSV.parse(described_class.new(Form.none, format: :csv).call).first
    question_count = QuestionnaireConfig.principle_keys.size + QuestionnaireConfig.dimensions.size +
      QuestionnaireConfig.extension_indicator_keys("chile").size

    expect(headers).to(eq(Forms::ExportTable.new(Form.none).call.first))
    expect(headers.count { |header| header.match?(/\A(Principio|Dimensión|Indicador): /) }).to(eq(question_count))
  end

  it "keeps a field agent's text from running as a formula in a spreadsheet" do
    create(:form, user: user, name: "=HYPERLINK(\"http://evil.test\")", phone: "+56 9 1234 5678")

    row = csv_rows.first

    expect(row["Nombre del predio"]).to(eq("'=HYPERLINK(\"http://evil.test\")"))
    expect(row["Teléfono"]).to(eq("'+56 9 1234 5678"))
  end

  it "keeps numeric-looking text as text in Excel and scores as numbers" do
    form = create(:form, user: user, name: "1e3", national_id: "001234", phone: "56912345678")
    create(:form_response, form: form, indicator_key: "biodiversity", value: 7)

    cells = xlsx_cells(described_class.new(Form.all, format: :xlsx).call)

    expect(cells.fetch("001234")).to(eq("inlineStr"))
    expect(cells.fetch("56912345678")).to(eq("inlineStr"))
    expect(cells.fetch("1e3")).to(eq("inlineStr"))
    expect(cells.fetch("7")).to(eq("n"))
  end

  it "still exports a form whose territory the questionnaire no longer has" do
    form = create(:form, user: user, name: "Antigua")
    form.update_column(:territory_key, "retired_territory")

    row = csv_rows.first

    expect(row["Nombre del predio"]).to(eq("Antigua"))
    expect(row["Territorio"]).to(eq("retired_territory"))
  end

  it "still exports a form whose system types were never set" do
    form = create(:form, user: user, name: "Sin sistemas")
    form.update_column(:system_types, nil)

    expect(csv_rows.first["Tipos de sistema"]).to(be_nil)
  end

  it "builds an Excel workbook holding the same rows" do
    create(:form, user: user, name: "La Esperanza")

    xlsx = described_class.new(Form.all, format: :xlsx).call
    sheet = Zip::File.open_buffer(StringIO.new(xlsx)).read("xl/worksheets/sheet1.xml")

    expect(xlsx).to(start_with("PK"))
    expect(sheet).to(include("Nombre del predio", "La Esperanza", "Luis Soto"))
  end
end
