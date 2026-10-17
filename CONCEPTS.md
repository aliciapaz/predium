# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Questionnaire

### Principle
One of the six agroecology principles a farm is scored on directly, at Level 1: biodiversity, recycling, system interactions, ecological soil management, ecological pest and disease management, and traditional knowledge. A Principle is answered on the same 1 to 10 scale as an Indicator but belongs to no Dimension; the six answers are the Level 1 score and the entry point to the Level 2 diagnosis.

### Indicator
A single Level 2 question, scored 1 to 10, that measures one Dimension. Indicators are defined by Territory Extensions, not by the core config, so the set a farm answers depends on its territory.

### Territory Extension
A YAML file under `config/questionnaire/extensions/` that supplies the Indicators for one territory, each attached to a core Dimension. An extension may build on another one (Chiloe on Chile), inheriting every parent Indicator and adding its own. A response whose key comes from a Territory Extension is flagged `is_extension`.

## Forms and Sync

### Form
A single farm diagnosis: one farmer's farm assessed on one visit, holding the farm's information and its questionnaire responses. Forms are created and edited locally on the field device first and reach the server through sync, so a Form has an identity that exists before the server has ever seen it.

### Draft
The initial Form state: editable, incomplete, and owned by its author's device. In a sync conflict over a Draft, the local version wins after the user confirms, on the assumption that a Draft is edited on one device at a time (simultaneous multi-device editing is out of scope; last-writer-wins is the accepted semantics).

### Completed
The terminal Form state, entered once every Principle and every Indicator of the form's territory is scored (a form with no territory completes on the six Principles alone). Completion locks the scores: a Completed Form can no longer be edited, and in any sync conflict the server's copy of a Completed Form is authoritative.

### Dirty
A local Form whose edits have not yet reached the server. Dirty Forms are protected: a server reseed never overwrites them, and cleanup never prunes them, even when the server does not list them.

### Sync Queue
The device-local list of Forms waiting to be pushed to the server. It holds at most one entry per Form; the pushed payload is built from the Form's current local state at push time, so repeated edits collapse into a single upsert. A queue entry survives until the server has acknowledged a push that included every local edit.

### Sync Base
The server version a Form's local edits were built on, carried with the Form and sent with every push. The server rejects a push whose Sync Base is older than its own copy, which is how conflicting edits are detected. The Sync Base is owned by the local storage layer: every write path preserves the newest known value, because an edit that erases it makes the device's own next push look like a conflict.
