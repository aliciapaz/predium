# frozen_string_literal: true

require "json"

# Rings 2-4 of the design harness: a fast, dependency-free scan of views,
# Stimulus markup and helpers for values and structures the design system
# already owns. Messages name the replacement so an agent can fix the line
# without opening the docs. Rules: docs/design-system.md#enforcement.
class DesignCheck
  Violation = Struct.new(:path, :line, :rule, :message) do
    def to_s = "#{path}:#{line}: #{rule}: #{message}"
  end

  ROOT = File.expand_path("..", __dir__)
  TOKENS_FILE = "app/assets/tailwind/tokens.css"
  SCAN_GLOBS = ["app/views/**/*.erb", "app/javascript/**/*.js", "app/helpers/**/*.rb"].freeze
  # Email clients ignore stylesheets, so mailer templates need inline values.
  SKIP = %r{(^|/)(mailer|layouts/mailer)}
  # The primitive sources themselves define what the rules forbid elsewhere.
  PRIMITIVE_SOURCES = ["app/helpers/design_system_helper.rb", "app/javascript/lib/ui.js"].freeze
  ALLOW_MARKER = "design-check:allow"

  COLOR_PREFIX = "(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|fill|stroke|from|via|to|" \
    "placeholder|accent|caret|decoration|shadow)"
  SHADED_COLOR = %r{(?<![\w-])((?:[a-z]+:)*#{COLOR_PREFIX}-([a-z]+)-(\d{2,3}))(?:/\d+)?(?![\w-])}
  TOKEN_FAMILIES = "canvas|sunken|surface|line|muted|ink|primary|accent|focus|deep|warning|danger|score|white|black"
  NAMED_COLOR = %r{(?<![\w-])(?:[a-z]+:)*#{COLOR_PREFIX}-((?:#{TOKEN_FAMILIES})(?:-[a-z]+)*)(?:/\d+)?(?![\w-])}
  HEX = /(?<![&\w])#(?=[0-9a-fA-F]*\d)(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/
  COLOR_FUNCTION = /\b(?:rgba?|hsla?|oklch)\(/
  COLOR_VAR = /var\(--color-([a-z0-9-]+)\)/
  ARBITRARY = /(?<![\w-])(?:[a-z]+:)*[a-z][\w-]*-\[[^\]\s"']+\]/
  # ERB tags inside the element (`value="<%= v %>"`) must not end the match.
  RAW_CONTROL = /<(input|select|textarea)\b((?:<%.*?%>|[^>])*)>/m
  FIELD_CLASS = /(?<![\w-])field(?![\w-])/
  NON_TEXT_INPUT = /type=["'](hidden|checkbox|radio|submit|button|file|range|color)["']/
  CLASS_ATTR = /class(?:Name)?=["']([^"']*)["']|class:\s*["']([^"']*)["']/
  TAG_HELPER = /\b(?:text_field_tag|email_field_tag|password_field_tag|number_field_tag|telephone_field_tag|date_field_tag|select_tag|text_area_tag)\b/
  INLINE_SVG = /<svg\b/
  # A utility name completed at runtime ("badge-#{tone}", `badge-${tone}`)
  # is invisible to Tailwind's scanner and never generated.
  DYNAMIC_CLASS = /(?<![\w-])[a-z][a-z0-9]*-(?:\#\{|\$\{)/
  RAW_TABLE = /<table\b(?![^>]*\bdata-table\b)/

  LEGACY = {
    "earth" => "neutrals: canvas, sunken, surface, line-soft, line, line-strong, muted, ink-soft, ink",
    "forest" => "primary, primary-ink, primary-soft, primary-line (actions) or score-high-* (scores)",
    "mustard" => "warning, warning-soft, warning-line, warning-mark or score-mid-* (scores)",
    "rose" => "danger, danger-soft, danger-line, danger-mark or score-low-* (scores)",
    "red" => "danger, danger-soft, danger-line, danger-mark",
  }.freeze

  class << self
    def run(argv, stdin: $stdin, out: $stdout, err: $stderr)
      return run_hook(stdin, err) if argv.first == "--hook"

      violations = new.check(argv.empty? ? nil : argv)
      violations.each { |v| out.puts(v) }
      out.puts(violations.empty? ? "design-check: clean" : "design-check: #{violations.size} violation(s). Rules: docs/design-system.md")
      violations.empty? ? 0 : 1
    end

    # Editor gate: Claude Code PostToolUse hook. Exit 2 feeds stderr back to
    # the agent; any other outcome stays silent.
    def run_hook(stdin, err)
      path = JSON.parse(stdin.read).dig("tool_input", "file_path").to_s
      relative = path.delete_prefix("#{ROOT}/")
      checker = new
      return 0 unless checker.in_scope?(relative) && File.exist?(File.join(ROOT, relative))

      violations = checker.check([relative])
      return 0 if violations.empty?

      err.puts("Design system violations in #{relative} (fix before moving on, see docs/design-system.md):")
      violations.each { |v| err.puts("  #{v}") }
      2
    rescue JSON::ParserError
      0
    end
  end

  def initialize(root: ROOT)
    @root = root
    @tokens = File.read(File.join(root, TOKENS_FILE)).scan(/--color-([a-z0-9-]+):/).flatten.to_set
  end

  def check(paths = nil)
    files = paths || SCAN_GLOBS.flat_map { |glob| Dir.glob(glob, base: @root) }.sort
    files.select { |path| in_scope?(path) }.flat_map { |path| check_file(path) }
  end

  def in_scope?(path)
    SCAN_GLOBS.any? { |glob| File.fnmatch?(glob, path, File::FNM_PATHNAME | File::FNM_EXTGLOB) } && !path.match?(SKIP)
  end

  private

  def check_file(path)
    source = File.read(File.join(@root, path))
    lines = source.lines
    found = []
    lines.each_with_index do |text, index|
      next if allowed?(lines, index)

      found.concat(line_violations(path, index + 1, text))
    end
    found.concat(control_violations(path, source, lines))
    found
  end

  def allowed?(lines, index)
    lines[index].include?(ALLOW_MARKER) || (index.positive? && lines[index - 1].include?(ALLOW_MARKER))
  end

  def line_violations(path, number, text)
    found = []
    add = ->(rule, message) { found << Violation.new(path, number, rule, message) }

    text.scan(SHADED_COLOR) do |full, family, _shade|
      add.call("token.color", "`#{full}` is not a design token. Use #{LEGACY.fetch(family, LEGACY["earth"])}.")
    end
    text.scan(NAMED_COLOR) do |(name)|
      next if @tokens.include?(name)

      add.call("token.color", "`#{name}` is not a color token. Defined tokens: #{@tokens.to_a.join(", ")}.")
    end
    text.scan(HEX) { |hex| add.call("token.color", "raw color `#{hex}`. Use a token class, or var(--color-*) / tokenColor() in JS.") }
    text.scan(COLOR_VAR) do |(name)|
      add.call("token.color", "`--color-#{name}` is not a color token. Defined tokens: #{@tokens.to_a.join(", ")}.") unless @tokens.include?(name)
    end
    if text.match?(COLOR_FUNCTION)
      add.call("token.color", "raw color function. Use a token class, or var(--color-*) / tokenColor() in JS.")
    end
    text.scan(ARBITRARY) do
      add.call("token.arbitrary", "arbitrary value `#{Regexp.last_match(0)}`. Use the Tailwind scale or a token; add a token if none fits.")
    end
    if text.match?(INLINE_SVG) && !PRIMITIVE_SOURCES.include?(path)
      add.call("primitive.icon", "inline <svg>. Use icon(:name) in views or icon(\"name\") from lib/ui.js.")
    end
    if text.match?(DYNAMIC_CLASS)
      add.call("token.dynamic-class", "class name built by interpolation. Tailwind never sees it; map each option to its full literal class name.")
    end
    if text.match?(RAW_TABLE)
      add.call("pattern.table", "<table> without the data-table pattern. Add class=\"data-table\" inside a card-flush overflow-x-auto wrapper.")
    end
    if text.match?(TAG_HELPER) && !text.match?(FIELD_CLASS)
      add.call("primitive.field", "form tag helper without the field primitive. Use labeled_field(...) or pass class: \"field\".")
    end
    text.scan(CLASS_ATTR) { |a, b| found.concat(class_violations(path, number, a || b)) }
    found
  end

  def class_violations(path, number, classes)
    list = classes.split
    found = []
    if list.intersect?(["fixed", "sticky"]) && list.include?("bottom-0")
      found << Violation.new(path, number, "pattern.action-bar", "screens do not pin their own bars to the bottom. Use the action-bar pattern.")
    end
    if list.include?("bg-primary") && list.any? { |c| c.start_with?("px-", "py-", "rounded") }
      found << Violation.new(path, number, "primitive.button", "hand-built button. Use btn-primary (or btn-secondary, btn-quiet, btn-danger).")
    end
    found
  end

  def control_violations(path, source, lines)
    source.to_enum(:scan, RAW_CONTROL).filter_map do
      match = Regexp.last_match
      attrs = match[2]
      next if attrs.match?(NON_TEXT_INPUT)

      classes = attrs[CLASS_ATTR, 1].to_s.split
      next if classes.include?("field")

      number = source[0...match.begin(0)].count("\n") + 1
      next if allowed?(lines, number - 1)

      Violation.new(path, number, "primitive.field", "<#{match[1]}> without the field primitive. Add class=\"field\" or use labeled_field(...).")
    end
  end
end
