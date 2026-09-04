## Why

The IDE's language intelligence is real and well tested — dialect-aware
completion, inline diagnostics as you type, the program outline, variable-usage
navigation, keyword reference lookup — and every bit of it stops at the edge of
the browser tab. Someone who keeps their programs in a repository and edits them
in the editor they already use gets a plain text buffer: no keyword completion,
no error until they paste the listing back into the IDE, no way to jump from
`GOSUB 500` to line 500.

`use-the-toolchain-from-the-command-line` made the *toolchain* reachable outside
the browser, as "a second, process-free caller of the same members". It left the
*editor* half where it was, because nothing outside a browser had a way to ask
for it. The Language Server Protocol is that way, and it is the only one worth
building: one server answers VS Code, Neovim, Helix, Emacs and everything else
that speaks it, and none of them needs anything written for it specifically.

What makes this proposable now rather than a rewrite is that the editor's own
answers turn out to be reachable from Node unchanged — so this change is a third
caller of the modules the IDE already uses, not a second implementation of them.

## What Changes

- **The tool learns to serve an editor.** A new operation starts a language
  server that speaks the protocol over its standard streams and stays running,
  answering an editor's questions about the program being edited until the
  editor disconnects.
- **A program gets bound to a machine.** The other operations are told with an
  option; an editor is told by the listing's own declaration where it has one, by
  a setting otherwise, and where neither says, the server infers the machine from
  the program and declines when it cannot tell — the user is then asked rather
  than guessed at.
- **Six things the IDE already answers become answerable in any editor**:
  problems as the editor's own diagnostics, completion of what the machine
  understands, a keyword's own explanation where it is written, jumping to a
  line or procedure from where it is named, the program's structure, and every
  use of a variable.
- **Serving an editor needs no ROM**, and never boots a machine — it is the
  check-and-describe half of the toolchain, not the running half.

## Non-goals

- **An extension for any particular editor.** No VS Code extension, no
  marketplace packaging, no publisher identity, no client-side settings UI. This
  change ships a server; wiring it to an editor is that editor's generic
  language-server configuration, and the documentation says how.
- **Packaging and publishing.** Still no `bin` entry, no `files` list, no npm
  metadata — deferred by `use-the-toolchain-from-the-command-line` and still
  deferred. The server is reached the way every other operation is.
- **Syntax highlighting, renaming and inline annotation.** Highlighting a buffer
  over the protocol, renaming a variable across a program, renumbering as an
  editor command, and showing what an address resolves to are all reachable from
  what this change builds, and none of them is needed for the server to be worth
  running. They are proposed on top of this change rather than folded into it.
- **Running or debugging a program from the editor.** A different protocol, a
  different shape, and it would drag the emulator, the ROMs and their global
  setup into a long-lived process that this change is careful to keep out.
- **Editing anything but a BASIC listing.** Machine-code blocks live inside the
  IDE's own project format, not in the file an external editor has open.
- **Changing what the IDE's editor does.** Every answer served here is the answer
  the IDE already gives; where the two could drift, they are made to share the
  code rather than agree by inspection.
- **Anything the earlier change already settled** — the tool's name, its grammar
  of named operations, and how it reads a program are inherited, not revisited.

## Capabilities

### New Capabilities

- `language-server`: what an editor other than the IDE's own can ask about a
  BASIC program, how it is told which machine the program is for, and what it
  gets back.

### Modified Capabilities

- `headless-cli`: gains the operation that starts a server, and scopes two of
  its existing promises — that standard output carries only what was asked for,
  and that an exit code reports a verdict — to the operations that report and
  finish, since a server holds its output stream open for a conversation and has
  no verdict to give.

## Impact

**Depends on** `use-the-toolchain-from-the-command-line` having landed: the
operation grammar, the pure-operation-plus-shim split, and the rule that only
running a machine requires a ROM are all assumed rather than restated.

**Depends on** `say-which-machine-a-program-is-for` for the top of the binding
chain. A listing that declares its own machine is the only thing that serves a
repository holding programs for several machines, which is the shape this
project's own samples tree has. The declaration is a source-format change
reaching every path that turns text into bytes, so it is proposed on its own
rather than folded in here; this change reads it and works without it, binding by
setting and inference until it lands.

**A third caller for the editor modules.** The IDE's completion, outline,
variable-usage and reference-lookup logic is already free of the browser — the
suite that covers it runs under Node with no DOM — and the parts that are shaped
for CodeMirror are shaped for its state layer, which is equally free of the
browser. So the work is a translation layer between the protocol's vocabulary
and the answers those modules already produce, plus the document bookkeeping a
long-lived server needs. This was verified before proposing, on three machines
with different keyword tables: the classification, the completion and the
reference lookup all answer correctly outside a browser.

That matters beyond effort. The editor capability already promises never to
colour a word as a keyword while its checks call the same word something else; a
second classifier written for this server would be a standing invitation to
break that promise on one side only. Sharing the code makes the two agree by
construction.

**No machine is booted, so the long-lived process stays clean.** The runner
installs stand-ins for browser globals while a machine runs and takes them down
afterwards — correct for a process that does one thing and exits, and hostile to
one that stays up. Nothing this change serves needs a machine, so none of it is
reached.

**The reference tables.** A keyword's own explanation lives in the shared
reference data, which the app is barred from loading eagerly so it stays out of
the initial download. The server loads it the way the assistant already does —
on demand, per page — so the bar stays where it is and no exemption is needed.

**One new dependency**, the reference implementation of the protocol
(`vscode-languageserver` and its document companion). Both are MIT, which is
compatible with this project's GPL-3.0-or-later, and neither reaches the browser
bundle: they are imported only by the server's own entry point. Writing the
protocol by hand was considered and rejected — it is a large specification, and
getting its framing, capability negotiation and lifecycle subtly wrong is the
kind of bug that shows up as one editor misbehaving.

**Inference is not written here.** `src/share/compatibility.ts` already answers
which registered machines a listing tokenizes cleanly on, for the share flow. The
server binds when that answer names exactly one machine and declines otherwise,
rather than scoring the registry a second way — a user who has seen the product
say a program is compatible with four machines should not then see it assert the
program is for one of them.

**Every registered machine.** The binding, the completion and the diagnostics
have to hold for all of them, from what each declares — so the tests are
registry-driven from the start rather than written for one machine and
generalised later.
