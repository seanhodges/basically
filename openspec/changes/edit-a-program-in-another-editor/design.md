## Context

`docs/contributing/architecture.md` describes the `Dialect` seam, the editor
services built on it and the headless toolchain that calls it outside the
browser; this document only says where the server goes and why it can be so
small.

The short version: the IDE's language intelligence is not welded to the browser.
`src/editor/` splits into modules that are pure functions over strings
(`programOutline.ts`, `variableUsages.ts`, `variableLint.ts`, `lineNumbering.ts`,
`variables.ts`) and modules shaped for CodeMirror. The CodeMirror-shaped ones
reach for `@codemirror/state`, `@codemirror/language` and
`@codemirror/autocomplete` — none of which needs a DOM — rather than
`@codemirror/view`, which does. The IDE's own unit suite already proves it:
`vite.config.ts` sets `environment: 'node'`, and `src/editor/completions.test.ts`
builds real `EditorState`s and drives a `CompletionContext` with no jsdom, noting
that "the snippet machinery only touches state, not the DOM".

## Goals / Non-Goals

**Goals:**

- One server, reached as an operation of the existing tool, that any
  protocol-speaking editor can launch.
- Every answer it gives is the answer the IDE gives, produced by the same code.
- A document is bound to a machine explicitly where the user has said, inferred
  where they have not, and the inference can decline.
- Nothing about the change requires a ROM or boots a machine.

**Non-Goals:**

- **A pure-data language service with no CodeMirror in it.** Tempting on paper,
  and it would mean a second tokenizer and the drift the editor capability
  forbids. Rejected on those grounds, not on effort.
- **Extracting the stream tokenizer out of `src/editor/basicLanguage.ts`.** It
  would be the right move if the server could not use CodeMirror headlessly. It
  can, so the refactor buys nothing and risks the shipping editor.
- **Serving more than one workspace folder's worth of settings.** One machine per
  workspace is the shape a retro BASIC project actually has; per-folder overrides
  can follow if anyone wants them.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. Every member the server reads already exists and already has a browser
caller: `lint`, `keywords`, `operators`, `languageSupport`, `completionSource`,
`crunched`, `statementSeparator`, `id`/`name`/`docsReference`. No member is
added, widened or reinterpreted, and no `MachineEmulator` member is touched at
all — the server never constructs one. `src/dialects/types.ts` keeps its two
CodeMirror type imports; they are `import type`, erased at build, and the server
is simply a second consumer of the members they describe.

### The server answers with the editor's own code, through a headless editor state

For each open document the server holds an `EditorState` built from the bound
dialect's `languageSupport()`, and asks it the questions `src/components/`
asks in the browser: `tokenAt` for what is under the cursor, `referenceTokenAt`
+ `lookupWord` for which keyword that is, `dialect.completionSource` for what may
be typed. The pure modules are called directly.

This was proved before proposing rather than assumed. On `zx81`, `commodore64`
and `bbcmicro` — three different keyword tables, one of them crunched — a
headless `EditorState` parsed the listing, `tokenAt` classified `PRINT` as a
keyword, `referenceTokenAt` resolved it, and `dialect.completionSource` returned
61, 68 and 123 ranked options respectively with `PRINT` among them. The reference
page loaded on demand and yielded the row for `PRINT` with its syntax and
description intact.

*Alternative rejected: a second, pure classifier composed from `CrunchMatcher`,
`keywordSpellingsFor` and `variableTokenAt`, pinned to the CodeMirror one by a
crosscheck test.* It would work, and a crosscheck is this project's usual answer
to two sources of one fact. But the two would still be two, the crosscheck would
only cover the corpus it was given, and `openspec/specs/code-editor/spec.md`
makes the agreement a product promise rather than a nicety. Sharing the code
makes the promise structural.

### Pure handlers in `src/lsp/`, one shim that owns the streams

The same split the command line already uses: `src/cli/*.ts` are pure and
`process`-free, and `scripts/headless/cli.mts` is the shim that reads files,
prints and sets exit codes. So `src/lsp/` holds handlers that take documents and
protocol parameters and return protocol results, and
`scripts/headless/lsp.mts` holds the connection — `createConnection`, document
synchronisation, and the wiring between them. Handlers stay unit-testable without
a transport, which is the whole point of the split.

The operation itself costs the five touchpoints an operation always costs:
`OPERATIONS` and the `CliArgs` union and a `parseLsp` in `src/cli/args.ts`, an
entry in `src/cli/usage.ts` (`args.test.ts` loops `OPERATIONS` and requires one),
and a case in `main()`. It is the one operation whose normal path never returns
an exit code.

### A document is bound to a machine by setting, then by inference, then not at all

| Source | When |
| --- | --- |
| `basically.machine` from client configuration | Whenever set; always wins |
| `initializationOptions` | Clients that do not implement pull configuration |
| Inference from the listing | Only when neither is set |
| Declined | Inference cannot choose |

Inference scores every registered dialect by how many fatal problems
`dialect.lint()` reports and takes a unique minimum; a tie declines. It runs when
a document opens, not on every keystroke, and the result is cached against the
document. Most of these machines share most of BASIC, so ties will be common —
that is the mechanism working. A declined binding publishes one diagnostic naming
the setting, because silence reads as a broken server and a `window/showMessage`
is easy to miss in a terminal editor. Re-reading configuration re-publishes
diagnostics for every open document.

`findMachine` in `src/dialects/headless/runListing.ts` already resolves a name by
id, then case-insensitive id, then display name; the setting uses it, so the
server and the `-m` option accept the same spellings.

### Diagnostics carry the severity the tokenizers already declare

`TokenizeError.fatal` distinguishes a framing error the machine could not store
from statement-shape lint it would happily store — and `hasFatalErrors` reads an
absent `fatal` as fatal. The server maps that to `Error` and `Warning`.

Worth stating because the two callers differ today: `src/cli/lint.ts` honours
`fatal`, and `src/editor/lintIntegration.ts` hardcodes `severity: 'error'`. The
server follows the command line. That is a deliberate difference from the IDE and
not drift in the sense the previous decision guards against — it is presentation
of the same error set, not a different reading of the program.

Positions need converting in both axes: `TokenizeError` is 1-based line and
0-based column, the protocol is 0-based in both, and an absent `endColumn` means
"to the end of the line", exactly as `lintIntegration.ts` treats it.

### Completion passes through templates that are already in the protocol's syntax

`src/editor/constructs.ts` writes its block templates as `${1:I}` … `${0}` —
which is the protocol's snippet syntax, unchanged. So a construct becomes a
completion item with snippet insert-text and no translation. `EditorKeyword`'s
`signature` and `doc` become `detail` and `documentation`; `kind` becomes a
completion-item kind. The crunch re-anchoring in `src/editor/completions.ts`
(which re-computes the replacement range when a machine matches keywords greedily
mid-word) has to survive the translation, so it is asserted on a crunched machine
rather than assumed.

### Hover text comes from the reference tables, loaded on demand through an explicit map

`eslint.config.js` bans static imports of `src/reference/**` from anywhere in
`src/`, so the twelve thousand lines stay out of the browser's initial download.
The rule leaves `import()` alone, so the server needs no exemption — it does what
`src/ai/machineReference.ts` does, keyed by `referencePageOf(dialect)`.

It must be an explicit map of slug to `import()`, not a template literal. A
computed specifier draws a build-time warning ("A file extension must be included
in the static part of the import") and defeats the chunking the rule exists to
protect. `src/ai/machineReference.ts` already has the map; the decision is to
share it rather than write a second one.

Where a page has no row for the keyword, hover falls back to the dialect's own
`signature` and `doc`, so every machine answers something.

### Jumping needs no new analysis

A line reference is an integer literal after one of the keywords
`src/editor/lineNumbering.ts` already enumerates for renumbering (`GOTO`,
`GOSUB`, `THEN`, `ELSE`, `RESTORE`, `RUN`, `LIST`), which already skips strings,
comments and `#BIN` payloads. The destination is `findRowForLineNumber`. A
procedure or function reference resolves against
`collectVariables(...).procs`, whose `ProcRegion` already carries the name and
its row span. Variable uses come from `findVariableUsages`, which is pure and
already models the machine's identity rules — case folding, significant-character
truncation, scalar against array, `LOCAL` shadowing. It returns document offsets,
so the document store owns the offset-to-position conversion.

### Standard output belongs to the protocol

Every other operation treats stdout as the product and sends figures and notices
to stderr. For the server stdout *is* the protocol, and one stray `console.log`
corrupts the stream for the rest of the session. The existing `divertLogging()`
in `scripts/headless/cli.mts` already redirects `console.log`/`info`/`debug` to
stderr for the duration of a run, for the same class of reason; the server
installs the same diversion for its whole life, and logs to the editor through
the protocol's own log channel.

## Risks / Trade-offs

**Inference will often decline, and a user may read that as the tool failing** →
the diagnostic says which setting to set and the documentation leads with it.
Declining is much cheaper to recover from than a buffer full of diagnostics for
the wrong machine, which is what a confident wrong guess produces.

**Rebuilding an `EditorState` per keystroke could be wasteful** → the document
store caches per `(uri, version, dialect)` and CodeMirror parses lazily; the
existing `tokenAt` already forces a parse only up to the end of the line asked
about, within a budget. Diagnostics keep the editor's ~400 ms debounce.

**Startup pulls every dialect and every emulator core into the process** → paid
once when the editor launches the server, and already paid by every command-line
invocation today. Worth measuring rather than assuming; if it bites, the fix is
lazy dialect loading, which is a change to the registry and not to this server.

**A long-lived process inherits the bundle's global assumptions** → the bundle's
banner defines `globalThis.localStorage` as undefined, which is inert. The
genuinely hostile globals are the ones the runner installs and removes around a
machine, and the server never calls it. Stated as an invariant so it stays true.

**`--stdio` is the only transport** → node and socket transports exist in the
protocol, and no editor being targeted needs them. Adding one later is additive.

## Open Questions

- **A user-facing documentation page.** Wiring the server into an editor wants a
  page under `docs/guide/`, but `CLAUDE.md` forbids adding a sidebar entry in
  `docs/.vitepress/config.ts` without being asked. The page can be written and
  left out of the sidebar, or the question can be settled before the docs task is
  done. Needs the maintainer's call.
- **Whether `basically.machine` should also be accepted per file**, via a comment
  directive in the listing in the shape of `#BIN`. It would let one repository
  hold programs for several machines, which is a real thing this project's own
  samples do. Deliberately left out here: it changes the source format, and every
  tokenizer would have to tolerate it.
