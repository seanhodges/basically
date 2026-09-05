## Why

A block has a name, a kind, an address and a comment. BASIC can only see the
address, and only as a number the user types themselves:

```
10 RANDOMIZE USR 32768
```

Nothing connects that `32768` to the block sitting at `$8000`. Move the block —
which the Settings dialog invites, and which re-assembles its code and fixes up
its labels — and the BASIC still says `32768`, now pointing at nothing. The
program runs, calls into whatever happens to be there, and fails in whichever way
that machine fails. Delete the block and the same line survives, still valid
BASIC, still meaningless. Rename it and nothing happens, because nothing ever
referred to the name.

The block's own assembly does not have this problem: it has labels, and moving
the block rewrites its `ORG` and re-assembles so every absolute reference follows.
The gap is at the BASIC boundary, where the IDE knows the answer and the user is
made to keep it in their head.

The addresses in question are the least memorable numbers in the program.
`RANDOMIZE USR 32768`, `SYS 49152`, `CALL &2900` — a reader cannot tell which
routine is being called, or whether the number is even current. On machines with
several blocks the problem compounds: three USR calls to three magic numbers,
each of which silently rots the moment its block moves.

This design is inherited from the retired `memory-blocks-edit-export-and-plan.md`
(Stage 5). It is preserved here so retiring that document loses nothing; one part
of it is already out of date and is corrected below.

## What Changes

- BASIC can **name a block instead of its address**: `10 RANDOMIZE USR @kaleido`,
  `10 SYS @sprites`, `10 CALL @plot`. The IDE substitutes the block's current
  address everywhere the program is turned into bytes — running, exporting,
  linting, counting bytes.
- **Moving a block updates every reference to it**, because the reference is the
  name, not a copy of the address. Renaming or deleting a block leaves the stale
  references **marked as errors** at the exact token, rather than silently valid.
- **Completion offers block names**: after `@`, and after the machine's own call
  keyword (`USR`, `SYS`, `CALL`, `DEFUSR` — whichever that dialect uses), with the
  block's address, size and comment shown alongside.
- A **plain address that matches no block is a warning, not an error** — an
  observation that a `USR 32768` might have meant a block, offered without
  refusing to run. Plain numeric addresses keep working exactly as they do today.
- **The written program is unchanged.** Substitution happens on the way to bytes;
  the file the user saves keeps `@kaleido`. Anything that reads bytes back —
  import, detokenize — produces plain numbers, because that is what the machine
  stores.
- **A shared program with `@` refs works for the recipient**, because share links
  already carry blocks: the receiver resolves the names against the blocks that
  travelled with the program.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `memory-blocks`: one requirement added — *BASIC can refer to a block by name* —
  covering the reference syntax, substitution wherever the program becomes bytes,
  the stale-reference error, the unmatched-address warning, and that the saved
  source keeps the name.
- `code-editor`: the existing completion and linting requirements gain block
  names as a completion source and stale refs as a diagnostic. Confirm the exact
  requirement wording against the baseline when writing the delta.

`sharing-player` is **not** affected. Blocks already travel in a share link, and
the receiver resolves names by the same code path as the author. No share record
gains a field.

`hardware-transfer` is **not** affected beyond receiving already-substituted
source: export tokenizes the same bytes it would have tokenized had the user
typed the number.

`dialect-toolchain` is **not** affected — and this is the load-bearing claim of
the design. No tokenizer changes. Substitution happens above the seam, so every
dialect gets this at once and none of them learns a new syntax.

## Non-goals

- **Extending this to the `#BIN` directive.** The existing `#BIN <base64>`
  machine-code REM is position-relative — a verbatim line record spliced where
  the line sits — not a fixed-address block. The two syntaxes are deliberately
  disjoint and stay that way.
- **Arithmetic on references.** `@name` resolves to an address. Not `@name+3`,
  not `@name.size`, not expressions. If offsets turn out to be wanted, that is a
  later change with its own syntax question.
- **Naming anything other than blocks.** Not system variables, not screen
  addresses, not user-defined constants. The IDE knows a block's address; that is
  the whole basis of the feature.
- **Changing what is stored.** The tokenized program holds a number, as the
  machine requires. `@name` is IDE-side syntax, and importing a program back can
  only ever produce the number.
- **Rewriting the user's source on a move.** A move updates the *meaning* of the
  reference, not the text. The IDE does not edit the user's BASIC behind them.
- **Case-insensitive or fuzzy matching.** A reference names a block exactly, or
  it is an error.

## Impact

Affected code (as scoped by the retired plan; confirm against the tree when
implementing):

- New module for the reference scanner and resolver — substitution plus the
  column mapping that lets a diagnostic computed on substituted text land on the
  original `@name` token. Dialect-neutral; skips string literals and `REM` tails.
  Errors are `TokenizeError`-shaped, per the errors-not-throws convention.
- New app-level module holding the **single** substitution point, called ahead of
  every `dialect.tokenize`. Today those calls are in `src/components/EmulatorPane.tsx`
  (run), `src/components/TransferDialog.tsx` (export — note the dialect's own
  `BuildTarget.build` re-tokenizes the source it is handed, so substitution must
  happen before it), `src/components/ShareLinkDialog.tsx`, `src/app/useProgramStats.ts`,
  `src/app/importProgram.ts` and `src/app/programVocabulary.ts`. Enumerate them
  from the tree rather than trusting this list.
- `src/editor/lintIntegration.ts` — read blocks imperatively inside the debounced
  lint callback, so editing a block does not rebuild the editor extension, and
  remap diagnostic columns back through the resolver.
- `src/editor/completions.ts` and the editor host — block names after `@` and
  after the dialect's call keyword, in their own compartment. `isInsideString`
  already exists and should be reused.
- Each dialect declares which keyword introduces a machine-code call, so
  completion after `USR` / `SYS` / `CALL` / `DEFUSR` is data rather than a
  branch. Check whether the keyword capability domains already added for the
  porting guide carry this, before adding a field to the seam.

**One correction to the inherited design.** The retired plan specified that
documents containing `@` refs be flagged **not shareable**, pending a share
mechanism that could carry blocks. That mechanism shipped: share links carry
blocks today, and the guide documents it. So there is nothing to gate — a shared
document's blocks travel with it and the receiver resolves the names itself. Do
not implement the not-shareable flag.
