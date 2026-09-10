## Why

The language server exists so that a listing kept outside the browser gets the
same language help the IDE gives it. On two counts it does not. Completion
offers the machine's keywords but never the program's own variables, though the
capability spec already requires them — the server reaches for one of the two
completion sources the editor registers and never sees the other. And hover
already holds the reference's own entry for a keyword — how it is written, what
it does — but leaves the reader there, with no way to reach the page that entry
came from. In the IDE that page is one click from the keyword.

## What Changes

- Completion offers the variables the program has in scope where the cursor is,
  alongside the keywords and block constructs it already offers, on the
  machine's own rules for what makes two names the same variable.
- A variable completion is offered as a variable, so an editor showing kinds
  distinguishes it from a keyword.
- Nothing is offered for a variable inside a string literal, as nothing is for a
  keyword.
- A keyword the product's reference has an entry for is explained with a way to
  open that entry in full. A keyword the reference has no entry for is still
  explained from what the machine declares, and offers no such route rather than
  one that would arrive nowhere.
- A keyword written in one of the short spellings a machine accepts reaches the
  entry for the keyword it stands for, not for the spelling.

Not breaking: every completion and explanation served today is served the same
way, with more offered beside it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `language-server`: completion gains a scenario for the variables the existing
  requirement already promises; the requirement covering how a keyword explains
  itself gains the route to its full reference entry.

## Impact

- `src/lsp/completion.ts` — builds its items from the sources the document's own
  editor state carries, rather than from the dialect's keyword source alone.
  This makes the replaced range a property of each source's answer rather than
  one range shared by every item, because two sources can anchor differently on
  a machine whose ROM matches keywords greedily.
- `src/lsp/hover.ts` — the markdown for a keyword with a reference entry ends
  with the route to it.
- `src/dialects/referencePage.ts` — gains the rule for where a keyword's entry
  is published, beside the rule for which page a machine reads from, so the two
  callers that need it share one statement of it. `src/app/docsTopic.ts` calls
  through, unchanged in behaviour.
- No change to the `Dialect` seam, to any machine, or to the protocol the server
  advertises: no new capability is declared, because none is needed.
- No new dependency.
- `basically-editor-extensions` is unaffected until a release carries this, at
  which point its pinned server version moves. That is its change, not this one.

## Non-goals

- **Numbering the lines a block construct expands to.** A multi-line construct
  is still inserted unnumbered over the protocol, as the editor outside the
  browser owns its own line numbering. Worth revisiting; not here.
- **Resolving a completion in a second round trip.** Everything a completion
  carries is carried at once.
- **Trigger or commit characters**, and with them the IDE's behaviour where
  typing `.` accepts the offered keyword on a machine that abbreviates that way.
- **Listing a keyword's short spellings in its explanation.** The reference's
  own list of them belongs to every machine sharing a page, so it cannot be
  shown as this machine's without narrowing it first.
- **A command, menu row or panel in any editor client.** The route offered here
  is one the explanation itself carries, so every client that renders an
  explanation has it without being taught anything.
