## Why

Renumbering a listing is one of the oldest things a BASIC environment does, and
the IDE has done it for a long time: a line's number changed, or a whole program
laid out on even increments, with every `GOTO`, `GOSUB`, `THEN`, `ELSE`,
`RESTORE`, `RUN`, `LIST` and `LLIST` reference following the line it names.
Someone editing the same listing in another editor gets none of it.

They cannot be given it by their editor either, and that is the point. Knowing
which keywords take a line reference, that a number inside a string or after
`REM` is not one, that a computed `GOTO X+1` must be left alone, that an opaque
binary record is bytes rather than text however much its base64 looks like
`RUN12`, and that some machines accept a line with no number at all — that is
knowledge of the machine's language. It is exactly the knowledge the editor
clients are built not to hold: every language answer they give comes from this
server, and the VS Code client parses no BASIC whatsoever.

So an editor cannot renumber, and the one thing that knows how to will not be
asked. The server settles a program's machine, reads its references for
jump-to-definition, and holds the text — and then declines to offer the one
operation all of that is already sufficient for. Meanwhile the browser IDE's own
renumbering is written as plain functions of a string, free of the DOM and
already on this server's import graph, because jump-to-definition reuses half of
it. What is missing is not the capability. It is a way to ask for it.

## What Changes

- **The server offers to renumber a whole program**, laying it out on even
  increments from the increment in force, and rewriting every line-number
  reference to follow.
- **The server offers to change one line's number**, rewriting the references to
  that line, and re-sorting the program. A line that has no number is given one
  appropriate to where it sits, which is what the IDE does with the same action.
- **A renumbering arrives as an edit the editor applies** to the program it
  already has open, rather than as replacement text the caller must do something
  with — so it lands in the user's undo history like any other edit.
- **A renumbering that cannot be carried out changes nothing and says why** — a
  number already taken, a number out of range, a program too long for the
  increment asked for, or a program that has been edited since the request was
  made.
- **A line the machine accepts without a number, and an opaque binary record,
  keep their text and their place**, while the references either carries still
  follow. This is what the IDE already guarantees; it now holds over the
  protocol too.
- **The increment is configurable**, as it is in the IDE, and defaults to ten
  where it has not been configured.
- Existing behaviour is untouched. No existing answer changes, and an editor
  that never invokes either command is unaffected. **Not breaking.**

## Capabilities

### Modified Capabilities

- `language-server`: the capability is stated throughout as help *about* a
  program — problems, completion, explanation, jumping, structure, colour.
  Renumbering is the first thing the server does that *changes* a program, so a
  requirement is added for it. The capability's purpose enumerates the
  answer-only help and will need widening to admit editing; a delta carries
  requirements rather than purpose, so that sentence is refreshed when this
  change is archived.

## Non-goals

- **Anything in the VS Code client.** This change ends with a server that can be
  asked and no client asking. Wiring the editor's own commands is a separate
  proposal in `basically-editor-extensions`, which cannot start until a release
  carries this and the pinned version can move. The contract here is designed
  for that client, but does not wait on it — the Vim plugin, and any editor that
  speaks the protocol, gets renumbering the day this ships.
- **A new toolchain operation, or `basically renumber` on the command line.**
  The language server is not one of the operation layer's callers; it answers
  hover, completion and definition from `src/lsp/` directly, and this is answered
  the same way. A command-line renumbering is a separate change if it is ever
  wanted, and would be an operation rather than this.
- **Offering renumbering as a suggested fix.** It is an action a user asks for by
  name, not a remedy for a problem the server found, and the server declares only
  what it answers rather than putting a suggestion on every numbered line.
- **Changing what renumbering means.** Which keywords carry a reference, what
  happens to an unnumbered line, and how a binary record is preserved are all
  settled and stay settled. This exposes that behaviour; it does not redefine it.
- **Anything in the browser IDE.** It renumbers directly and needs nothing from
  this. One rule it currently states in its own UI — that a line number already
  in use cannot be moved onto — is lifted into a shared predicate so the server
  and the IDE state it once, with no change to what either does.

## Impact

- **`src/lsp/`** gains the two answers and, for the first time, produces an edit
  rather than a description; `scripts/headless/lsp.mts` gains the capability
  declaration and the wiring that applies it.
- **`src/editor/lineNumbering.ts`** is reused as-is for the renumbering itself,
  and gains one small exported predicate so the "already taken" rule has a single
  home.
- **Every editor client** gains the capability without being taught anything
  machine-specific, which is the whole reason it belongs here.
- **`basically-editor-extensions`** is the immediate caller. Its follow-up will
  be the first thing in that repository to change the user's buffer, and it will
  need to reach the language client its commands do not currently talk to.
