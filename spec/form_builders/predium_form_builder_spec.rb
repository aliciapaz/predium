# frozen_string_literal: true

require "rails_helper"

RSpec.describe(PrediumFormBuilder, type: :helper) do
  let(:user) { build(:user, email: "agente@predium.cl") }

  def form(&block)
    html = helper.form_with(model: user, url: "/users", builder: described_class, &block)
    Nokogiri::HTML.fragment(html)
  end

  it "applies the field primitive to text controls and keeps layout classes" do
    html = form { |f| f.email_field(:email, class: "mt-2") + f.select(:locale, [["ES", "es"]]) }

    expect(html.at("input[type=email]")["class"]).to(eq("field mt-2"))
    expect(html.at("select")["class"]).to(eq("field"))
  end

  it "styles labels, checkboxes and the submit button" do
    html = form { |f| f.label(:email) + f.check_box(:remember_me) + f.submit("Entrar") }

    expect(html.at("label")["class"]).to(eq("field-label"))
    expect(html.at("input[type=checkbox]")["class"]).to(eq("checkbox"))
    expect(html.at("input[type=submit]")["class"]).to(eq("btn-primary"))
  end

  it "styles Rails 8's checkbox under both names" do
    html = form { |f| f.checkbox(:remember_me) + f.check_box(:remember_me, id: "second") }

    expect(html.css("input[type=checkbox]").map { |box| box["class"] }).to(eq(["checkbox", "checkbox"]))
  end

  it "keeps a different button primitive when the view asks for one" do
    html = form { |f| f.submit("Cancelar", class: "btn-quiet") }

    expect(html.at("input[type=submit]")["class"]).to(eq("btn-quiet"))
  end

  it "marks invalid controls with aria-invalid instead of wrapping them" do
    user.errors.add(:email, :blank)

    html = form { |f| f.email_field(:email) }

    expect(html.at("input[type=email]")["aria-invalid"]).to(eq("true"))
    expect(html.at(".field_with_errors")).to(be_nil)
  end

  it "shows the attribute's error under the control and points the control at it" do
    user.errors.add(:email, :blank)

    html = form { |f| f.email_field(:email) }

    error = html.at("input[type=email] + p.field-error")
    expect(error.text).to(eq("Escribe tu correo electrónico."))
    expect(html.at("input[type=email]")["aria-describedby"]).to(eq(error["id"]))
  end

  it "keeps a description the view already gave the control" do
    user.errors.add(:email, :blank)

    html = form { |f| f.email_field(:email, "aria-describedby": "email_hint") }

    expect(html.at("input[type=email]")["aria-describedby"]).to(eq("email_hint user_email_error"))
  end

  it "adds no error text to a valid control" do
    html = form { |f| f.email_field(:email) }

    expect(html.at(".field-error")).to(be_nil)
    expect(html.at("input[type=email]")["aria-describedby"]).to(be_nil)
  end
end
