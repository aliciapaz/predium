# frozen_string_literal: true

require "rails_helper"
require "design_check"

RSpec.describe(DesignCheck) do
  around do |example|
    Dir.mktmpdir do |dir|
      @root = Pathname.new(dir)
      @root.join("app/assets/tailwind").mkpath
      @root.join("app/assets/tailwind/tokens.css").write("--color-ink: #000;\n--color-primary: #111;\n--color-primary-soft: #222;\n")
      example.run
    end
  end

  def check(path, source)
    file = @root.join(path)
    file.dirname.mkpath
    file.write(source)
    described_class.new(root: @root.to_s).check([path]).map(&:rule)
  end

  it "passes markup built from tokens and primitives" do
    source = <<~ERB
      <div class="card text-ink bg-primary-soft">
        <input type="text" class="field" id="name">
        <input type="checkbox" value="x">
        <table class="data-table"></table>
      </div>
    ERB

    expect(check("app/views/forms/ok.html.erb", source)).to(be_empty)
  end

  it "flags default and legacy palette classes, unknown tokens, and raw colors" do
    source = <<~ERB
      <p class="text-gray-500 bg-earth-50 hover:text-rose-600 text-ink-strong" style="color: #a1b2c3"></p>
    ERB

    expect(check("app/views/x.html.erb", source)).to(eq(["token.color"] * 5))
  end

  it "flags arbitrary values" do
    expect(check("app/views/x.html.erb", '<div class="min-h-[44px]"></div>')).to(eq(["token.arbitrary"]))
  end

  it "flags class names completed by interpolation, in Ruby and JS" do
    expect(check("app/helpers/x_helper.rb", 'tag.span(class: "badge-#{tone}")')).to(include("token.dynamic-class"))
    expect(check("app/javascript/x.js", "const c = `badge-${tone}`")).to(include("token.dynamic-class"))
    expect(check("app/javascript/y.js", "getPropertyValue(`--color-${name}`)")).to(be_empty)
  end

  it "flags text controls without the field primitive, across multiline tags" do
    source = <<~ERB
      <input type="email"
             class="rounded border">
      <select id="g"></select>
    ERB

    expect(check("app/views/x.html.erb", source)).to(eq(["primitive.field", "primitive.field"]))
  end

  it "reads past ERB inside a tag and does not mistake field-hint for field" do
    source = <<~ERB
      <input value="<%= value %>" type="hidden">
      <%= text_field_tag :q, nil, class: "field-hint" %>
    ERB

    expect(check("app/views/x.html.erb", source)).to(eq(["primitive.field"]))
  end

  it "checks var(--color-*) references against the tokens" do
    expect(check("app/javascript/x.js", 'el.style.color = "var(--color-ink)"')).to(be_empty)
    expect(check("app/javascript/x.js", 'el.style.color = "var(--color-gray-500)"')).to(eq(["token.color"]))
  end

  it "flags inline svg, hand-built buttons, pinned bottom bars and raw tables" do
    source = <<~ERB
      <svg viewBox="0 0 24 24"></svg>
      <button class="bg-primary px-4 rounded-lg"></button>
      <div class="fixed bottom-0"></div>
      <table></table>
    ERB

    expect(check("app/views/x.html.erb", source))
      .to(eq(["primitive.icon", "primitive.button", "pattern.action-bar", "pattern.table"]))
  end

  it "honours a design-check:allow marker on the line or the line above" do
    source = <<~ERB
      <meta content="#24603a"><%# design-check:allow browser chrome %>
      <%# design-check:allow manifest literal %>
      "#f4f6f0"
    ERB

    expect(check("app/views/x.html.erb", source)).to(be_empty)
  end

  it "skips mailer templates" do
    expect(check("app/views/devise/mailer/reset.html.erb", '<p style="color: #123456"></p>')).to(be_empty)
  end

  describe ".run_hook" do
    def hook(path)
      err = StringIO.new
      status = described_class.run_hook(StringIO.new({ tool_input: { file_path: path } }.to_json), err)
      [status, err.string]
    end

    it "exits 2 with the violations when an edited view breaks the rules" do
      file = Rails.root.join("tmp/design_check_hook_spec.html.erb")
      stub_const("DesignCheck::SCAN_GLOBS", ["tmp/*.erb"])
      file.write('<p class="text-gray-500"></p>')

      status, output = hook(file.to_s)

      expect(status).to(eq(2))
      expect(output).to(include("token.color"))
    ensure
      file&.delete
    end

    it "stays silent for files outside its scope" do
      expect(hook(Rails.root.join("README.md").to_s)).to(eq([0, ""]))
    end
  end
end
