## Context

`src/ops/` declares each toolchain operation once (`Operation<I,O>` in
`src/ops/types.ts`) and derives every caller's surface from that one
declaration; see `docs/contributing/architecture.md` for the shape callers
share. `machines`, `info`, `lint`, `build`, `run`, `check`, `drive`, `look`,
`screenshot`, `profile`, `time`, `variables` and `expect` are registered in
`src/ops/registry.ts`. `src/ops/parity.ts` + `src/ops/parity.test.ts` hold
every operation to being reachable from every caller (`cli`, `assistant`,
`mcp`) or carrying a declared, reasoned exemption; MCP may carry none at
all.

Every dialect that has a binary program format already declares
`binaryImports: { extension, label }[]` and implements
`detokenize`/`detokenizeWithReport` (`src/dialects/types.ts`), returning a
`DetokenizeResult` (`source`, `warnings`, and optional `blocks`,
`tapeFiles`, `autoStart`, `bootDisc`). `src/dialects/roundTripHarness.ts`
states the contract every dialect's importer already meets:
`tokenize(detokenize(image))` reproduces the image byte-for-byte with no
errors, or the report carries a warning saying what was lost.
`src/app/importProgram.ts` is the existing caller of that machinery: given a
dialect already known and a file's bytes, it returns the source plus a
fidelity-checked warning list. The browser's Import dialog and drag-and-drop
handler are both thin wrappers around it. What none of that machinery does
is decide *which* dialect a blob of bytes belongs to — every existing caller
already has the dialect fixed (the open project).

## Goals / Non-Goals

**Goals:**

- Add a `convert` operation that reads a machine's own binary program file
  and returns the BASIC it holds, reusable from the command line and from
  MCP, reporting anything the conversion could not carry rather than
  dropping it.
- Add the one piece of machinery that doesn't already exist: inferring
  which registered machine a file's bytes belong to when the caller doesn't
  name one, declining cleanly when more than one machine could claim it.

**Non-Goals:**

- **Converting between two machines' dialects.** `convert` reads one
  machine's binary into that same machine's BASIC; translating a program
  from one machine to another is unrelated to this change.
- **The reverse direction (BASIC source → machine binary).** That is
  `buildOp` (`src/ops/build.ts`), already reachable from every caller.
  `convert`'s CLI usage text points there rather than `convert` dispatching
  to it internally — one operation, one direction, no duplicated routing.
- **Editing what was converted.** The output is text; what happens next is
  the user's business.
- **Assistant reachability.** See Decisions below — this ships as a
  declared exemption, not new plumbing.
- **The Dialect/MachineEmulator seam is unchanged.** `convert` adds no new
  member to `Dialect`; it is a new, caller-agnostic wrapper around
  `detokenize`/`detokenizeWithReport` and `binaryImports`, which already
  exist on the seam.

## Decisions

**One new operation, modeled on `build.ts`/`lint.ts`.** `src/ops/convert.ts`
exports `convertOp: Operation<ConvertInput, ConvertOutcome>` with
`needs: 'nothing'` (pure over its input bytes, no machine boot), appended to
`OPERATIONS` in `src/ops/registry.ts` (append rather than insert — the
array's order is load-bearing for the assistant's tool-definition cache
stability). Input: `{ base64: string; fileName?: string; machine?: string }`;
`decodeBytes` (`src/ops/bytes.ts`) turns `base64` into the raw bytes to hand
to the dialect. Output: `{ machine: {id,name}; source: string; warnings:
string[]; blocks?: ...; tapeFiles?: ...; autoStart?: number | null }`,
mirroring `DetokenizeResult` with any byte payloads (`blocks`, a `bootDisc`)
base64-encoded the same way `build.ts` encodes its output files. No
`failed()`: reaching a `RunError` (unreadable input, unresolved machine) is
the only failure mode — detokenize doesn't reject input the way tokenize
can, so there's no partial/fatal outcome shape to test for.

**Reuse `importProgram`, don't reimplement it.** `src/app/importProgram.ts`
already assembles `detokenizeWithReport` (falling back to `detokenize` with
no warnings) plus a fidelity check (re-tokenizing the recovered source and
warning if that now fails or comes back empty) into one result. `convertOp`
calls the same function rather than duplicating that logic. `src/ops/`
imports neither the DOM nor the store (enforced by `eslint.config.js`), and
`importProgram` today has no such import itself — it takes a `Dialect` and
bytes and returns a plain object — so it can be called directly from
`src/ops/convert.ts` with no browser dependency to strip out.

**Machine inference is new, and lives on the dialect side, not in
`src/ops/`.** A small helper — `src/dialects/binaryFormatLookup.ts` —
takes a file name (optional) and returns every registered dialect whose
`binaryImports` declares a matching extension. `convertOp.run` uses
`requireMachine(input.machine)` when a machine is named; otherwise it calls
the lookup and requires exactly one match, raising a `RunError` that names
every candidate when there is more than one (several machines share
extensions — e.g. `.tap` — so the lookup must be able to decline rather
than guess) and a `RunError` saying no machine's format matches when there
are none. This lives next to the dialect registry, not inside `src/ops/`,
because it is a fact about the dialects (which machines can produce which
extension), the same kind of fact `src/dialects/*.test.ts` already pins
registry-wide — its own colocated test iterates every dialect declaring
`binaryImports`, so a newly added binary format is covered without a new
test file.

**Assistant reachability: a declared exemption, not new plumbing.** Every
existing assistant-reachable operation's input schema carries only JSON the
model already has or can compute (typically the open editor's text,
injected as a string by `src/ai/promptBuilder.ts`). Nothing in `src/ai/`
today carries an arbitrary binary file's bytes from the user's disk into a
tool call — `op.input` schemas are JSON, not a file-attachment channel, and
building one would be a change to the assistant's whole input surface, not
a property of this operation. `src/ops/parity.ts` gets one more entry:

```ts
{
  operation: 'convert',
  caller: 'assistant',
  reason:
    "The assistant's tool inputs travel as JSON matching a declared " +
    'schema, with no path from the model to bytes sitting on the user\'s ' +
    "disk — every existing tool's input is text already in the editor or " +
    'already produced by another operation. The browser\'s own Import ' +
    'dialog already gives the user this exact capability from inside the ' +
    'IDE, which is the reason this reaches no caller without one.',
}
```

`convert` still declares `mcp: { kind: 'tool' }` — MCP may carry no
exemptions at all (`parity.test.ts` asserts this categorically), and MCP is
exactly the caller with no IDE behind it, so it is where this operation is
needed most.

**CLI grammar mirrors `check`/`lint`'s stdout convention, not `build`'s
mandatory `-o`.** `basically convert <in> [-m <machine>] [-o <path>]` —
`<in>` is read as bytes (a new binary-safe reader in `scripts/headless/cli.mts`,
since `readProgram` there is UTF-8-text-only), and the recovered BASIC is
written to `<path>` when given, stdout otherwise: the product here is text,
not a binary blob, so there's no reason to force a file the way `build`
does. Exit codes follow the existing split (`EXIT_BAD_REQUEST` for an
unreadable file, an unresolved or ambiguous machine, or an unknown option;
0 otherwise — there is no `EXIT_BAD_PROGRAM`-equivalent outcome for this
operation).

## Risks / Trade-offs

- **A file whose bytes could plausibly belong to more than one machine**
  (shared extensions across dialects) → mitigated by declining rather than
  guessing, and naming every candidate so the caller can retry with `-m`;
  this is the behavior the proposal itself calls for.
- **Lossy conversions read as silently broken** → mitigated by reusing
  `importProgram`'s existing fidelity check and surfacing every warning,
  block, tape file and auto-start line in the outcome and in `describe()`'s
  prose rather than only in a machine-readable field.
- **The assistant exemption reads as a missing feature rather than a
  decision** → mitigated by writing its reason (per `parity.ts`'s own
  convention) about the assistant's circumstances — no file-attachment
  channel exists for any tool today — rather than about `convert` itself,
  and by naming the existing alternative (the Import dialog) a user already
  has inside the IDE.
