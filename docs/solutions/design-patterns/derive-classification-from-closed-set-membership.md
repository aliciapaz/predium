---
title: Derive a two-way classification from closed-set membership, not absence
date: 2026-09-14
category: design-patterns
module: Questionnaire configuration and form responses
problem_type: design_pattern
component: service_object
severity: medium
related_components:
  - rails_model
  - frontend_stimulus
applies_when:
  - "A boolean or two-way flag is computed as \"not in set A\""
  - "Set A is open to growing a third category later (a new kind that is neither A nor B)"
  - "The same derivation is duplicated across server, client, and validation"
tags:
  - classification
  - flag-derivation
  - membership-vs-absence
  - is-extension
  - questionnaire
---

# Derive a two-way classification from closed-set membership, not absence

## Context

The questionnaire config had exactly two response kinds and tagged each response with `is_extension`. The flag was computed by *absence* from the core indicator set, in three places (server sync, and implicitly on the client and in validation):

```ruby
# before (app/services/forms/sync_upsert.rb, pre-refactor)
response.is_extension = !QuestionnaireConfig.core_indicator?(key)
```

That reads as "if it is not a core indicator, it is a territory extension." It was correct only while responses were strictly `{core indicator, territory extension}`. The two-level refactor introduced a third response kind, the Level 1 principle, which is core (not an extension) but is *not* a core indicator either. Under the old rule every principle answer would silently be flagged `is_extension: true`, and because the same "not in set A" shortcut was duplicated on the client and in the response-key validation, the misclassification would have appeared in three spots that must agree.

## Guidance

Derive a two-way flag by testing membership in the set whose definition is **closed and stable**, then negate that, rather than testing absence from a set that a future category can also fall outside of.

Principles are a fixed, enumerable set of six keys in `core.yml`; "extension" is the open-ended side. So derive the flag from the closed side:

```ruby
# after (app/models/form_response.rb) — derived from the closed set, in one place
def assign_extension_flag
  return if indicator_key.blank?

  self.is_extension = !QuestionnaireConfig.principle?(indicator_key)
end
```

Two supporting moves make this hold:

- **Derive once, at the lowest layer.** The flag is now computed in a single `before_validation` on the model, so callers cannot set it inconsistently and there is one definition to keep correct instead of three.
- **Validate by positive membership, not by absence.** Whether a key is allowed for a form is `principle? || in the territory chain` (`QuestionnaireConfig.known_key?`), each an explicit membership test, rather than "not unknown."

## Why This Matters

An absence-based classification has no room for a third category: the moment you add a kind that is neither A nor B, it is silently bucketed as B, and nothing fails loudly. The cost is worst when the derivation is duplicated, because every copy misclassifies the same way and the bug looks like data, not logic. Testing membership in the closed set instead means a new, unanticipated kind lands *outside* both branches, where it surfaces (a validation miss, an explicit `else`, a failing test) rather than masquerading as the open category.

In this codebase the absence-based flag also fed a downstream offline-sync path (responses are pruned and re-synced by `is_extension`), so a misclassified principle would not just be mislabeled, it would be subject to the wrong prune and sync rules. A flag that several layers trust should be derived from the most stable predicate available.

## When to Apply

- Any time a flag or branch is written as `!in_set_A(x)` and set A could gain a sibling category.
- When the same classification is computed in more than one layer (server, client, validation): centralize it and derive from the closed set once.
- When choosing which side of a binary to test: prefer the side that is a fixed, enumerable list over the side that grows with new territories, plugins, or types.

## Examples

Before — absence from the set that is about to gain a sibling:

```ruby
is_extension = !core_indicator?(key)   # a principle (core, non-indicator) becomes is_extension: true
```

After — negation of closed-set membership, computed once:

```ruby
is_extension = !principle?(key)        # principles are a fixed set of six; everything else is an indicator
```

The tell that you are on the wrong side: adding a new category to the domain forces you to *find and change* the flag's callers so the new kind is not swept into the open bucket. Deriving from the closed set means the new kind is excluded automatically, and any place that genuinely needs to handle it fails visibly instead.

## Related

- `docs/solutions/logic-errors/offline-form-sync-clobbers-inflight-edits.md` — the offline-sync layer that consumes `is_extension`; a misderived flag would feed its prune/sync rules the wrong inputs.
