## Context

The language server's split — pure handlers in `src/lsp/`, a connection shim in
`scripts/headless/lsp.mts` — and how a document reaches its dialect's own
`languageSupport()` are described in `docs/contributing/architecture.md`
(*Serving an editor: the language server*). Nothing here changes that shape;
this adds one more answer to it.

## Goals / Non-Goals

**Goals**

- One reading of a program. What the server says a run of characters is must be
  what the IDE's own editor says it is, by construction rather than by
  agreement.
- No dialect learns anything. A machine that colours correctly in the browser
  colours correctly in an editor, on the day it is registered.
- A long listing costs what the editor asks for, not what the file contains.

**Non-Goals**

- Modifiers, deprecation, unused-variable marking (see the proposal).
- Any artefact an editor has to be handed separately.

## Impact on the Dialect / MachineEmulator seam

**None.** No member is added to `Dialect` or `MachineEmulator`, and no dialect
file changes. The classification comes from `Dialect.languageSupport()`, which
every registered dialect already implements and which the server already builds
an `EditorState` from for completion, hover, definition, symbols and references.
This change reads that same state a different way.

## Decisions

### The classification is the stream language's own tags, not a mapping table

`src/editor/basicLanguage.ts` is a CodeMirror `StreamLanguage`, and
`@codemirror/language` names each node after the tag string the tokenizer
returned. `src/editor/tokenAt.ts` already leans on exactly this and says so in
its header comment:

> *A stream language names its nodes after the tag strings its tokenizer
> returns … There is no mapping table to keep honest, and a tag renamed on
> either side stops matching here.*

The tokenizer returns ten tag strings: `keyword`, `functionName`, `operator`,
`meta`, `labelName`, `comment`, `string`, `variableName`, `number`, `atom`.

**Decision: walk that same tree over a range and report the runs it holds.** The
alternative — classifying the text again against the dialect's keyword list —
would be a second reading, and would diverge first on exactly the cases that
motivate this change: a crunched run splitting ROM-style, a short spelling, a
name that is a keyword on one machine only.

The cost is that the tag vocabulary is now load-bearing in a second place. That
is the same cost `tokenAt.ts` already pays, and the same mitigation applies: a
renamed tag stops matching, and a test names each tag it depends on.

### Two kinds the protocol has no word for

Eight of the ten tags have an obvious protocol counterpart: `keyword`,
`function`, `operator`, `comment`, `string`, `number`, `variable`, and `macro`
for the `#MACHINE` / `#BIN` directives the tokenizer tags `meta`.

Two do not. A **line number** is not a number — the IDE colours the two
differently because they are different things, and a line number is the one
token in a BASIC listing an editor's "go to symbol" cares about. A **graphics
escape or inverse-video glyph** is not a string either.

**Decision: declare `label` and `atom` alongside the standard kinds.** The
protocol lets a server name its own kinds, and an editor that does not know one
simply leaves those runs unstyled — which is what every editor does with every
run today, so nothing regresses. The VS Code client in
`seanhodges/basically-editor-extensions` maps both to theme scopes explicitly;
the guide tells users of other editors the two names, so they can style them.

Collapsing them into `number` and `string` was rejected: it would report a
falsehood in order to avoid a name, and line numbers in particular would then be
indistinguishable from the numeric literals beside them.

### Whole program and range, and what to do when the parse lags

CodeMirror parses lazily, so the tree for a long listing covers only what has
been asked for. `tokenAt.ts` handles this by forcing the parse up to the end of
the clicked line within a budget, and using whatever tree exists if the budget
runs out.

**Decision: the same treatment, over the requested range**, with the range
request served as itself rather than by slicing a whole-program answer. An
editor showing one screen of a 2000-line listing then pays for one screen. A
budget that runs out yields the runs that were parsed, not an error: a partly
coloured listing is what the user would see mid-scroll in any editor, and it
resolves itself on the next request.

Deltas (`semanticTokens/full/delta`) are not implemented. The listing is
re-classified from a cached `EditorState` that `DocumentStore` already keys by
`(version, dialect id)`, and a BASIC program is small; the bookkeeping a delta
needs would cost more than it saves.

### Nothing for an unbound document

`DocumentStore.editorState` already returns null for a document whose binding
declined, because there is no dialect to build a state from. Colour inherits
that: no state, no runs. The user is not left wondering — the binding already
publishes a diagnostic saying what to set.
