## Context

The language server's split is described in
`docs/contributing/architecture.md` § *Serving an editor: the language server*:
`src/lsp/` holds pure, `process`-free, connection-free answers, and
`scripts/headless/lsp.mts` owns the streams, the lifecycle and the configuration
pull. Every answer is the browser editor's own, reached headlessly — there is no
second reading of a program anywhere in the server.

Renumbering fits that shape almost exactly, because the work is already done and
already pure. `src/editor/lineNumbering.ts` imports nothing but
`../dialects/binaryDirective`, and half of it is on the server's import graph
today: `src/lsp/definition.ts` resolves a jump target with the module's own
`lineNumberReferenceAt`, on the stated grounds that a line reference is exactly
what renumbering already recognises. The rewriting half has simply never been
reachable from outside the browser.

Two things are genuinely new. The server has never declared a capability that
changes a program, and nothing under `src/lsp/` has ever produced an edit. And
the policy around renumbering — what to refuse, and what to say — currently lives
in the browser IDE's `CodeMirrorHost.tsx` as prompts and alerts, not in the pure
layer, so it has to be decided where a caller with no dialogs can reach it.

**Dialect/MachineEmulator seam: unaffected.** Nothing here boots a machine, reads
a ROM, or adds a member to either interface. The one machine-specific input is
`Dialect.unnumberedLineKey`, an existing optional member the renumbering helpers
already take as a predicate, and it is read through the binding the document
already carries.

## Goals / Non-Goals

**Goals:**

- Renumbering reachable over the protocol, by any client, with no client-side
  knowledge of BASIC.
- No new renumbering logic. The existing helpers answer, or the design is wrong.
- The pure/shim split preserved: everything decided in `src/lsp/`, nothing but
  wiring in `scripts/headless/lsp.mts`.
- Useful to a client that contributes no configuration at all.

**Non-Goals:**

- The VS Code client (a separate proposal; see the proposal's non-goals).
- A toolchain operation or a command-line renumbering.
- Suggested fixes / code actions.
- Any behavioural change to the browser IDE.

## Decisions

### Commands, not code actions

`executeCommandProvider` with two commands, `basically.lsp.renumberLine` and
`basically.lsp.renumberFile`. A code action was the alternative and is the wrong
fit twice over: renumbering is invoked by name rather than offered as a remedy
for something the server found, and the shim's own rule is to declare only what
it answers — a lightbulb on every numbered line is noise. The `lsp.` segment
keeps these distinct from the command ids an editor client contributes in its own
manifest, which will be `basically.renumberLine` and friends; two namespaces that
differ only by which process owns them would be a lasting confusion.

### The pure layer answers with an edit it does not send

`src/lsp/renumber.ts` returns a plain discriminated result — an edit with the row
the cursor should end on, an "unchanged", or a refusal carrying its own sentence.
It never touches the connection, so it is driven by a unit test exactly as
`definition.ts` and `symbols.ts` are. `scripts/headless/lsp.mts` does the three
lines of wiring: apply the edit, or show the refusal, and return the result so a
client that wants to act on it can.

The alternative — returning the edit to the caller as the command's result and
letting it apply — was rejected because it makes every client responsible for
converting and applying, for no gain. Sending `workspace/applyEdit` means a
client's whole implementation is one request.

### One whole-document edit

Renumbering re-sorts lines, removes blank ones and can renumber every line at
once, so a minimal-diff edit would be a diff engine's worth of work to produce
something that is usually the whole document anyway. One `TextEdit` over the full
range, which the editor records as a single undoable change.

The cost is the cursor: a full-range replacement does not preserve it. The IDE
deliberately keeps the cursor on the same program line, computed by rank among
the lines renumbering actually numbers — and that rank needs `isBinaryDirective`
and the dialect's unnumbered-line predicate, so a client cannot compute it. The
server therefore returns the row alongside the edit, and setting the selection is
two lines in the client.

### Policy moves to the server; only the asking stays with the client

The server owns the range check, the already-taken check, the overflow refusal,
the number-it-in-place branch for a line with no number, and the no-op for a line
the machine takes unnumbered. The client collects a number in an input box and
applies what comes back. Refusal sentences are the IDE's own, so a user meets the
same words in either place.

The already-taken rule is the one piece that exists in the browser UI rather than
in the pure layer, and duplicating it server-side would leave the same rule stated
twice. Rather than change `renumberLine` — which returns a bare string and has no
way to refuse, so giving it the check would ripple a signature change through the
IDE — a small predicate is exported from `src/editor/lineNumbering.ts` and both
callers use it. Pure refactor; no behavioural change.

### Increment pulled from configuration, argument wins

`basically.lineNumberIncrement` is pulled exactly as `basically.machine` already
is, with `initializationOptions` as the fallback for a client that cannot pull and
a re-pull on change. It defaults to ten and is clamped to the same bounds the IDE's
own setting uses. An explicit increment in the command arguments overrides it.

Argument-only was the alternative. Configuration wins because the Vim plugin has
no command surface of its own to pass arguments from, and because it matches how
the machine already reaches the server; the argument override is kept because it
costs nothing and is what the tests drive.

Two constraints follow from the client landing later: absent configuration is not
an error, and **no user-facing sentence may name the setting**, or a client that
has not yet contributed it would be told to set something that does not exist.
The refusal wording quotes the increment's value, never its name.

### A request is refused against a program that has moved on

Each command carries the document version it was computed against, and is refused
if the store's version has changed. Without it a request in flight while the user
types would apply a whole-document edit computed from stale text. Applying the
edit produces an ordinary `didChange`, which schedules diagnostics on the existing
debounce; nothing new is needed there, and rebinding is correctly not triggered,
since renumbering never touches the `#MACHINE` line.

## Risks / Trade-offs

- **A whole-document edit loses the cursor** → the server returns the row to
  restore it, computed the way the IDE computes it.
- **A refusal is only a message, so a scripted client learns nothing structured**
  → the command result carries the outcome as well, so a client that wants to
  branch on it can; the message is for the human.
- **The server names a setting no client contributes yet** → it never names it in
  a message, and works without it. Documented in the language-server guide, where
  an editor-agnostic user configures it through their own client.
- **The pure layer starts producing protocol edits, not just descriptions** →
  contained to one new module returning a plain result; the shim remains the only
  thing that talks to a connection, so the split that makes `src/lsp/` testable is
  intact.
- **Renumbering is exercised by no browser test today** and there is none to lean
  on → the new colocated tests carry it, including the cases the IDE's own
  untested UI branches cover: already-taken, out of range, overflow, an unnumbered
  line, and a machine that accepts unnumbered lines.
