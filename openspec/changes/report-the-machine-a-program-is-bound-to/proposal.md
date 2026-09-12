## Why

The server settles which machine a program is for before it answers anything
about it — that is how it decides what to colour, what to complete, and what a
keyword means. It then tells nobody. Its declared capabilities are the standard
providers and the semantic-token legend, and it offers no request, no command
and no experimental entry an editor could ask the question through.

That silence costs an editor a great deal. A listing the server cannot bind to a
machine is correctly left uncoloured — a name is a keyword on one machine and an
ordinary variable on another, and colouring it as either would be a guess — but
an uncoloured listing is also exactly what a user sees when the client failed to
load, when the server could not be started, and when the runtime that was found
could not run it. A packaging fault in the VS Code client was reported as "only
the brackets are coloured", because that was genuinely all there was to go on.

An editor that wants to say which machine a listing is being checked against
therefore cannot ask the connection it already holds. The VS Code client is
building this on the toolchain's operations conversation instead: a short-lived
`basically ops` process per listing, running `lint` to re-derive a machine this
server has already derived, with debouncing and per-version caching bolted on
because the answer costs a process. All of that machinery exists only because
the answer is not published where it was worked out.

## What Changes

- **The server reports the machine it bound a program to**, as part of what it
  publishes about that program, alongside the diagnostics it already publishes.
- **A program it declined to bind is reported as declined**, distinctly from one
  it has not yet seen — the difference an editor needs in order to tell correct
  silence from a broken client.
- **The report says where the machine came from** — declared, configured or
  inferred — which the server already distinguishes internally and which an
  editor may want to show or may ignore.
- **It is published unasked**, whenever the binding is established or changes:
  on open, on change, and when the configured machine changes and every open
  program is reconsidered.
- Existing behaviour is untouched. Nothing is removed, no existing answer
  changes, and an editor that ignores the report is unaffected. **Not breaking.**

## Capabilities

### Modified Capabilities

- `language-server`: *An editor is told which machine a program is for* already
  requires the server to settle the machine by a stated precedence and to say so
  where it cannot. What it does not require is that the answer be told to the
  editor in the ordinary case — only the failure is reported, and only as a
  diagnostic. A requirement is added for reporting the bound machine.

## Non-goals

- **Changing the precedence.** Which machine wins is settled and stays settled;
  this reports the answer, it does not compute a different one.
- **Replacing the diagnostic on an unbound program.** The sentence naming what
  to set stays exactly where it is. This report is machine-readable state for an
  editor's own surfaces, not a second place the remedy is written.
- **A request an editor can call.** Publishing costs nothing at the moment the
  binding is worked out; a request would make an editor poll for something the
  server already knows when it knows it.
- **Anything in the browser IDE.** The IDE knows its own machine directly and
  needs nothing from this.

## Impact

- **`src/lsp/`** gains the report and its publication points; the binding it
  reports is the one `bindMachine` already returns, `source` and all.
- **Every editor client** gains the answer for free, including the Vim plugin,
  which has no surface of its own but registers with hosts that show such
  reports.
- **`basically-editor-extensions`** is the immediate caller: the VS Code
  client's `say-which-machine-is-in-force` change is written so that moving onto
  this report deletes its caching, debouncing and pending-state machinery
  without changing any guarantee it makes to the user.
