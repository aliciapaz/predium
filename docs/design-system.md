# Predium design system

Predium is used by field agents on phones, often outdoors, one-handed, on
patchy connections, while talking to a farmer. Every interface decision
follows from that person.

The system is organised as five layers ([Onion Design Framework](https://www.teloslabs.co/layered/)).
Decisions live in the innermost layer that can enforce them:

| Layer | Lives in | Owns |
| --- | --- | --- |
| 1. Tokens | `app/assets/tailwind/tokens.css` | Every allowed color, font and shadow |
| 2. Primitives | `app/assets/tailwind/primitives.css`, `DesignSystemHelper`, `PrediumFormBuilder`, `app/javascript/lib/ui.js` | Fields, buttons, chips, cards, badges, alerts, meters, score options |
| 3. Patterns | `app/assets/tailwind/patterns.css`, `page_header` | Action bar, page header, section nav, disclosure, popover, auth panel |
| 4. Rules | This file | Which valid option to choose in a given product situation |
| 5. Screens | `app/views`, Stimulus renderers | The assembled experience. Disposable; regenerate after fixing inward |

**When a screen looks wrong, fix it inward.** Ask in order: is a token wrong
or missing? Can a primitive prevent it? Can a pattern absorb it? Is a rule
below missing or ambiguous? Only then is it a one-screen decision.

## Layer 1: tokens

Tailwind's default palette is reset. `bg-gray-100`, `text-rose-600` or
`border-earth-200` compile to nothing, and `bin/design-check` names them.

| Token | Use for |
| --- | --- |
| `canvas` | Page background |
| `surface` | Cards, fields, raised panels |
| `sunken` | Tracks, neutral chips, disabled fills |
| `line-soft` / `line` / `line-strong` | Inner dividers / card borders / control borders (at least 3:1 on `surface` and `canvas`, WCAG 1.4.11; never a decorative divider) |
| `ink` / `ink-soft` / `muted` | Headings and body / labels / metadata and hints |
| `primary` / `primary-ink` | The forward action, links / its hover and text on soft fills |
| `primary-soft` / `primary-line` | Selected and success fills / their borders |
| `accent` | Brand seed yellow; the current step's done mark |
| `focus` | Focus outline only (applied globally; at least 3:1 on `surface`) |
| `deep`, `deep-ink`, `deep-soft`, `deep-line`, `deep-hover` | The admin sidebar |
| `warning*`, `danger*` | Status: drafts, pending sync and offline / errors and destructive actions |
| `score-low*`, `score-mid*`, `score-high*` | 1-10 scores and their summaries only |
| `white` | Text on `primary` |

Fonts: `font-sans` (Atkinson Hyperlegible Next, the default for everything) and
`font-display` (Bricolage Grotesque, headings and numbers). Shadows:
`shadow-card`, `shadow-pop`, `shadow-bar`. Both fonts are self-hosted so they
work offline.

Canvas code reads tokens with `tokenColor("primary")` from `lib/ui.js`.

## Layer 2: primitives

| Need | Server view | Stimulus markup |
| --- | --- | --- |
| Text input, select, textarea | `form_with` (the builder adds `field`), or `labeled_field(id:, label:, as:)` | `class="field"` |
| Label / hint / error | builder `f.label`, or `field-label` / `field-hint` / `field-error` | same classes |
| Multi-select option | `<label class="chip"><input type="checkbox">Text</label>` (square mark; a radio chip gets a round one) | same |
| Checkbox in a sentence | `f.check_box` (adds `checkbox`) | `class="checkbox"` |
| Button | `btn-primary`, `btn-secondary`, `btn-quiet`, `btn-danger`; add `btn-compact` in dense rows | same |
| Icon-only button | `icon_button(:name, label:)` | `iconButton({ icon, label })` |
| Icon | `icon(:name)` | `icon("name")` |
| Card | `card` (padded) or `card-flush` (rows inside) | same |
| Status pill | `badge(text, tone:)` (text or a number; raises on a Hash, Array or relation) | `badge(text, tone)` |
| Message | `alert_box(message, tone:)` | `alert-success`, `alert-warning`, `alert-danger` |
| Progress | `meter` + `meter-fill` with an inline width | same |
| Connectivity | `status-pill` with `data-state` online, pending, expired or offline (offline is warning, not danger) | same |
| 1-10 score | n/a | `score-scale` of `score-option` labels around radios with `data-band`; the checked one is a solid band fill with white digits |
| Score value / bar | n/a | `score-chip` / `score-bar` with `data-band` from `band()` |
| Inline link | `link` | `link` |

Primitives carry state in attributes, never in toggled classes:
`:checked`, `aria-current="step"`, `aria-expanded`, `data-state`, `data-band`.
The helpers raise on misuse (an icon button without a label, an unknown tone
or icon, a field without a label) so the mistake surfaces in development.

## Layer 3: patterns

- **`action-bar`**: the only element a screen may pin to the bottom. One row,
  respects the home indicator, and hides while the on-screen keyboard is open.
- **`page_header(title, back: [label, path], subtitle:) { actions }`**: back link, `page-title`, optional subtitle and actions.
- **`section-nav` / `section-tab`**: horizontal steps with `aria-current="step"` and `data-state="done|partial|todo"`.
  Moving to a section scrolls its heading (a `scroll-anchor`) to the top, not the whole editor.
- **`scroll-anchor`**: a heading the screen scrolls to; lands just below the top edge.
- **`page-tabs`**: a `<nav>` of links between sibling pages of one area (an organization's forms and members), current one `aria-current="page"`. Filters inside a page use `segmented`.
- **`disclosure`**: a `<details>` group with a 56px summary row and a `disclosure-chevron`.
- **`field-group`**: a `<fieldset>` with a `legend` for related fields.
- **`popover`**: help text anchored to its trigger.
- **`auth-panel`**: the centered column for sign in and other account forms.
- **`data-table`**: tables, always inside `card-flush overflow-x-auto` so they scroll sideways on phones.
  Add `data-table-stacked` when status or actions sit in the last columns: below `sm` each row stacks
  and every cell shows its `data-label`. A cell without a label holds controls and collapses when empty.
- **`safe-top`**: top padding that clears the notch for edge content outside `app-bar`.

Server-side validation errors mark the control with `aria-invalid="true"`
(`config/initializers/field_error_proc.rb`), which the `field` primitive styles.

## Layer 4: rules

The coding agent MUST:

1. Build mobile first: every screen works at 360px wide before any `sm:` styles are added.
2. Give every tappable control at least 44px in both directions (primitives already do).
3. Use 16px or larger text in any control that opens the keyboard (the `field` primitive does), so iOS does not zoom.
4. Put a screen's persistent actions in one `action-bar`. A screen MUST NOT add other fixed or sticky bottom elements.
5. Show one primary button per view state. In the questionnaire, the primary action moves the agent forward: "Continuar" until the last section, then "Completar cuestionario". Everything else is `btn-secondary`, `btn-quiet` or an icon button.
6. Use score colors only for scores. Status uses `warning` (drafts, pending sync, offline) and `danger` (errors, delete). Offline is the field agent's normal state, never an error.
7. Name every icon-only control (`icon_button` / `iconButton` enforce it).
8. Write every user-facing string through I18n with correct Spanish orthography (accents, ñ, ¿ ¡). Spanish is the default locale.
9. Use sentence case for buttons and headings, and name buttons by what they do ("Completar cuestionario", not "Enviar").
10. A disabled control says why (a caption on the control or right next to it), or it is not shown. A feature that does not exist yet is not shown.
11. A destructive action names its item: the confirmation asks "¿Eliminar el diagnóstico de La Esperanza?", and an icon-only delete is labelled with the item ("Eliminar el diagnóstico de La Esperanza").
12. Print a diagnosis date with `form_date(form)`, which labels it ("Actualizado ...", "Completado ...") and localizes it; any other date goes through `l(date, format: :short)`. Never `strftime` in a view.
13. A questionnaire resumes where work remains: a draft opens on its first section that is not done, and while "Completar cuestionario" is disabled for missing indicators a quiet "Ir a lo que falta" jumps to the first section with gaps.

The coding agent SHOULD:

- Group long forms into `field-group`s of related fields, with the most-used fields first.
- Put a field's purpose in its label and any format guidance in `field-hint`, never in the placeholder alone.
- Set `inputmode` and `autocomplete` on text fields (`decimal` for areas, `tel` for phones). Coordinates are `type="number"` with no `inputmode`: the iOS `decimal` keypad has no minus sign, and coordinates south or west of zero are negative.
- Prefer a `chip` group over a row of checkboxes when there are seven or fewer options.

Exceptions need a reason in the PR description. When the same exception
repeats, the rule or a primitive should change instead.

## Enforcement

| Ring | Where | What |
| --- | --- | --- |
| 1. Primitives that refuse | `DesignSystemHelper`, `lib/ui.js` | Raise on unlabelled icon buttons, unlabelled fields, unknown icons or tones, badges given a collection |
| 2. Editor gate | `.claude/settings.json` hook | Runs `bin/design-check --hook` on every edited view, Stimulus file or helper; violations go straight back to the agent |
| 3. Local gate | `bin/design-check`, `bin/ci` | Scans everything in seconds |
| 4. CI | `.github/workflows/ci.yml` | Same scan; the build fails on any violation |

`bin/design-check` rules:

| Rule | Catches |
| --- | --- |
| `token.color` | Default or legacy palette classes, unknown token names, hex and `rgb()`/`hsl()` literals |
| `token.arbitrary` | Arbitrary values such as `min-h-[44px]` |
| `primitive.field` | Text controls without `field` |
| `primitive.icon` | Inline `<svg>` outside the icon primitives |
| `primitive.button` | Buttons built from `bg-primary` plus padding |
| `pattern.action-bar` | Hand-built fixed or sticky bottom bars |
| `pattern.table` | Tables without `data-table` |

A line that genuinely needs a literal (the browser `theme-color`, for
example) carries a `design-check:allow` comment with the reason on the same
line or the line above. Mailer templates are not scanned: email clients need
inline styles.
