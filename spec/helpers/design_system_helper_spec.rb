# frozen_string_literal: true

require "rails_helper"

RSpec.describe(DesignSystemHelper, type: :helper) do
  describe "#icon_button" do
    it "renders a named icon-only button" do
      html = Nokogiri::HTML.fragment(helper.icon_button(:close, label: "Cerrar aviso"))
      button = html.at("button")

      expect(button["aria-label"]).to(eq("Cerrar aviso"))
      expect(button["type"]).to(eq("button"))
      expect(button["class"]).to(include("icon-btn"))
      expect(button.at("svg")["aria-hidden"]).to(eq("true"))
    end

    it "refuses to render without an accessible name" do
      expect { helper.icon_button(:close, label: "") }.to(raise_error(ArgumentError, /needs a label/))
    end
  end

  describe "#icon" do
    it "refuses unknown icons and names the known ones" do
      expect { helper.icon(:rocket) }.to(raise_error(ArgumentError, /Known icons: .*chevron_left/))
    end
  end

  describe "#labeled_field" do
    it "associates the label and hint with a field-styled control" do
      html = Nokogiri::HTML.fragment(helper.labeled_field(id: "farm_phone", label: "Teléfono", type: "tel", hint: "Con código de área"))

      expect(html.at("label")["for"]).to(eq("farm_phone"))
      expect(html.at("input")["class"]).to(eq("field"))
      expect(html.at("input")["type"]).to(eq("tel"))
      expect(html.at("input")["aria-describedby"]).to(eq("farm_phone_hint"))
      expect(html.at("#farm_phone_hint").text).to(eq("Con código de área"))
    end

    it "renders selects with their options" do
      html = Nokogiri::HTML.fragment(helper.labeled_field(id: "gender", label: "Género", as: :select, options: [["Otro", "other"]]))

      expect(html.at("select option")["value"]).to(eq("other"))
    end

    it "refuses a control without a visible label" do
      expect { helper.labeled_field(id: "x", label: " ") }.to(raise_error(ArgumentError, /needs a visible label/))
    end
  end

  describe "#badge" do
    it "uses the literal tone class" do
      expect(helper.badge("Borrador", tone: :warning)).to(include('class="badge-warning"'))
    end

    it "refuses unknown tones" do
      expect { helper.badge("x", tone: :info) }.to(raise_error(ArgumentError, /not one of neutral, success, warning, danger/))
    end
  end

  describe "#alert_box" do
    it "marks danger alerts for assistive technology" do
      html = Nokogiri::HTML.fragment(helper.alert_box("Falló", tone: :danger))

      expect(html.at("div")["role"]).to(eq("alert"))
      expect(html.at("div")["class"]).to(eq("alert-danger"))
    end
  end
end
