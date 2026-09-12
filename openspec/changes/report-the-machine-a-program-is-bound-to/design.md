## Context

`src/lsp/binding.ts` already returns everything this change publishes:
`MachineBinding` is either a bound dialect with the `MachineSource` it came from
— `declared`, `configured` or `inferred` — or a decline carrying the reason the
user is shown. `src/lsp/documents.ts` holds that binding against each open
document and rebinds every one of them when the configured machine changes.

So nothing has to be worked out. What is missing is that the answer never leaves
the server. This is a publication point, not a new decision.

`docs/contributing/architecture.md` describes the LSP layering; it is not
restated here.

## Dialect / MachineEmulator seam

No impact. The binding is resolved through `findMachine` and the dialect
registry exactly as it is today, and nothing here reaches past the seam or
learns anything machine-specific. What is added is a notification carrying the
identity of a dialect that has already been chosen.

## Goals / Non-Goals

**Goals:**

- The bound machine known to the editor at the moment the server knows it.
- A decline reported as a decline, distinguishable from a program not yet seen.
- Published wherever diagnostics are published, so the two never disagree.
- Nothing for an editor that ignores it.

**Non-Goals:**

- A request to ask the question with.
- Any change to the precedence, to the diagnostic on an unbound program, or to
  any existing answer.

## Decisions

### A notification, not a request

The binding is established when a document is opened, when it changes, and when
the configured machine moves — the same three moments diagnostics are published
at. Publishing it there means an editor is never out of date and never asks. A
request would invert that: the editor would have to guess when to ask, and would
be asking for something the server had already finished working out.

It is published beside the diagnostics rather than inside them. A diagnostic is
a problem, and the ordinary case here is that there is no problem.

### A method of the server's own, declared in its capabilities

The protocol has no notification for this, so it is the server's own, under the
product's own namespace. An editor that does not know the method ignores it, as
the protocol requires; an editor that does should be able to find out that this
server sends it rather than discovering it by receiving one. That means an
experimental entry in the declared capabilities — the one place a client can
look before it has received anything.

### What it carries

The document it is about and its version, so an editor can match the report to
the text it holds rather than to whatever is in front of the user by the time it
arrives. Then either the machine — its id and its name, the two spellings used
everywhere else in the product — and where it came from; or that the binding was
declined. The decline carries no remedy text: that is the diagnostic's, and
saying it twice invites the two to drift.

### Why the version matters

The VS Code client's current workaround caches an answer against a document
version precisely because its answer arrives out of band and could be stale. A
report that names the version it is about removes that problem at the source
rather than making every client solve it again.
