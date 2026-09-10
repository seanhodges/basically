## Context

The language server answers on the same terms the browser editor does, by
running the editor's own decisions headlessly: `src/lsp/documents.ts` keeps an
`EditorState` per open document, built with the bound dialect's
`languageSupport()`, and each handler in `src/lsp/` turns that state's answer
into the protocol's shape. `docs/contributing/architecture.md` has the map.

Two places have drifted from that arrangement by reaching past the state for the
thing they wanted:

- Completion calls `dialect.completionSource` directly. But `buildBasicLanguage`
  registers **two** autocomplete sources on the language data — the keyword and
  construct source the dialect exposes, and the variable source built from that
  machine's own name rules — so naming one of them is naming half the answer.
  The other half is already on the state the server is holding.
- Hover composes from the reference entry it loaded, and stops. The rule for
  where that entry is published lives in `src/app/docsTopic.ts`, in the app
  layer, which the server has no business importing.

## Goals / Non-Goals

**Goals:**

- Completion offered over the protocol is the completion the editor offers, by
  construction rather than by two lists being kept alike.
- A keyword explained from the reference carries the route to the entry it was
  composed from, for every client, without a client being taught anything.
- The rule for where a keyword's entry lives is stated once.

**Non-Goals:**

- Numbering the lines a block construct expands to.
- A second round trip to resolve a completion; trigger or commit characters.
- Anything in a client repository. See the proposal's Non-goals.

## Decisions

### Ask the state for its completion sources, rather than naming one

`completionsAt` reads the sources off the document's own state —
`state.languageDataAt('autocomplete', pos)` — and runs each, exactly as
CodeMirror's own `autocompletion()` does. Every source the editor registers is
therefore answered over the protocol too, including any registered later.

*Alternative considered:* build the variable source in the server from
`variableRulesFor` and `outlineCapabilities` and call it alongside the dialect's.
Both ingredients are already imported next door in `src/lsp/definition.ts`, so
this is a small diff. Rejected: it is a second statement of a wiring
`buildBasicLanguage` already makes, and it goes stale silently the day a third
source is registered — the failure mode this change exists to fix.

### The replaced range belongs to each answer, not to the request

Today one range from the single result is put on every item. With two sources
that is no longer sound: on a machine whose ROM matches keywords greedily, the
keyword source re-anchors against the spellings it knows and the variable source
against the names it found, so the two can legitimately disagree about where the
user's word starts. Each item therefore carries the range of the result it came
from. Every completion already carries its own edit, so this is well-formed;
nothing about the protocol needed to change to allow it.

### The route is part of the explanation, not a command

The way to reach the full entry is a link in the markdown the server already
sends. Every client that renders an explanation gets it — the VS Code extension,
the Vim plugin, and whatever comes next — with no capability declared, no command
contributed, and nothing for a client to keep in step. A client-side command
would have to learn which page a machine reads from and how a keyword is looked
up in it, which is the server's knowledge, and only one client would have it.

### Only an explanation the reference is behind offers to go on

The fallback explanation, composed from what the machine itself declares for a
keyword the reference has no entry for, carries no route. The reference page
would open, search for a keyword it has no row for, and show nothing — worse than
not offering, because the reader spends the trip to find out.

### The publishing rule moves down beside the page rule

Where a keyword's entry is published — which page, opened at which keyword — goes
next to `referencePageOf` in `src/dialects/referencePage.ts`, whose header
already records that the neighbouring rule was recomputed in three places before
it was put there. It needs only the two fields `referencePageOf` takes, imports
nothing, and so is reachable from the server and from the app alike;
`src/app/docsTopic.ts` calls through and its behaviour is unchanged. The public
docs base is named there too, since a link leaving the browser has to be absolute
where the IDE's could be relative.

### Impact on the Dialect / MachineEmulator seam

**None.** No member is added, changed or read differently; no machine is touched;
no dialect gains or loses anything. Both changes are inside `src/lsp/`, plus one
leaf under `src/dialects/` that holds a publishing rule and imports nothing.

## Risks / Trade-offs

- **Scanning the document for variables on every completion request** → The
  variable source rescans the text each time it is asked. It is the same work the
  browser editor does on every keystroke, on the same documents, and the state is
  cached per version; a listing is a listing, not a codebase. No cache is added
  for a cost that has not been shown.
- **More items in the list, so a keyword ranks lower** → The editor's own ordering
  hints are not carried over the protocol today, and this change does not add
  them; a client sorts by its own match score. Worth watching once it is in a
  real editor, and cheap to address later by carrying a sort key.
- **A machine that abbreviates greedily now gets items with differing ranges** →
  Well-formed, but new. Pinned by the existing crunched-anchor test, which keeps
  holding for a reason worth writing down: the source blanks the word under the
  cursor before scanning, so a lone name completes to keywords rather than to
  itself.
- **The docs base is now named in the source** → A published URL in a shipped
  program is a thing that can rot. It is the address the product already puts in
  its own command-line help, and it is stated once.
- **A client that renders explanations as plain text shows the link as its
  markdown** → Acceptable: the URL is still readable and copyable, and the
  alternative is withholding it from clients that would render it well.

## Migration Plan

Nothing to migrate. No stored data, no protocol capability, no client change:
an older client talking to a newer server sees more completions and a longer
explanation. A newer client talking to an older server sees exactly what it sees
today, which is what lets a client repository move its pinned version whenever it
suits it rather than in step with this.

## Open Questions

- Should the ordering the editor uses — block constructs first, then commands,
  then the rest — be carried over the protocol as a sort key? Out of scope here;
  it is a separate question about ranking, and it now has two kinds of item to
  rank rather than one, which is the reason to ask it.
