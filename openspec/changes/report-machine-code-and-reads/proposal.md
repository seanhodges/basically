## Why

The guide's memory story is half told. It reports where the program's *writes*
land on the target — and nothing else about the ways a program touches the
machine directly:

- **Reads are invisible.** A program that PEEKs the keyboard matrix, a system
  variable, or the frame clock reaches the comparison with nothing to show for
  it: the vocabulary collects write sites only. On another machine those
  addresses hold something else, and a read is exactly as machine-bound as a
  write — it just fails more quietly, returning wrong numbers instead of
  corrupting memory.
- **Machine-code calls are ordinary keywords.** The call commands land in the
  missing-commands list as spelling problems, when the real finding is
  categorical: the routine at that address is processor code for the source
  machine, and no substitution, rename, or advice makes it run on the target.
  What the port needs is the one question the guide never asks — *what does
  this routine do* — because the answer (a sound effect, a scroll, speed) is
  what gets re-achieved with the target's own means. The comparison cannot
  answer it; it can pose it, per the posed-decision convention.
- **Attached code blocks are dropped on the floor.** The document format
  carries machine-code blocks with names and addresses, and the vocabulary
  scan explicitly skips them — so the one part of a program that is *pure*
  machine dependence contributes nothing to the porting story.

## What Changes

- **The vocabulary collects reads and calls beside writes**: the addresses the
  program reads with its PEEK-family syntax, and the addresses its
  machine-code call commands target — constant, computed-but-resolvable, or
  approximate, under the same rules as the write sites today. It also carries
  the program's attached code blocks — name, address, size — instead of
  skipping them.
- **The comparison reports where the program's reads land on the target**,
  with the same verdicts the writes get: same kind of thing elsewhere,
  something else, or an address the target does not have. A read landing on a
  named system region names it on both machines, which is what makes the
  target's own idiom findable.
- **Machine code is reported as work to re-achieve, not commands to rename.**
  The call sites and attached blocks are gathered into one finding among the
  rewrites, stating that the routines are the source machine's processor code
  and posing the decision: establish what each routine does, and do that with
  the target's own means. Where the machines' code-carrying formats differ,
  the existing guidance for that pair is cross-referenced rather than
  restated.
- **The call commands stop masquerading as renames or losses.** Run-a-routine
  commands that differ only in spelling are reported as the renames they are;
  a call function that returns a value on one machine and runs code on the
  other joins the same-word-different-meaning warnings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: two requirements added — *Where the program's reads land
  on the target is reported* and *Machine code the program calls is reported
  as work to re-achieve* — and one modified: *The memory layouts are narrowed
  to the program's own writes* becomes writes and reads.

## Non-goals

- **Disassembling or translating machine code.** The finding says what the
  blocks and call targets are and asks what they do; understanding Z80 or 6502
  is the assistant's or the reader's work, on request, not the comparison's.
- **Verdicts on block contents.** A block's bytes stay out of the vocabulary;
  its name, address and size are what the porting story needs.
- **A registry of what famous ROM routines do.** Tempting, unbounded, and a
  data set with no pin; the posed decision covers it honestly.
- **Read-site lint in the editor.** The editor's address checking concerns
  writes because writes corrupt; this change is about the porting story.

## Impact

Affected code:

- `src/dialects/types.ts` + per-dialect declarations — the read forms and call
  commands beside the existing write declaration, optional and untouched on
  machines declaring none.
- `src/editor/pokeAddresses.ts` + its test — the read and call scans beside
  the write scan whose machinery they reuse.
- `src/app/programVocabulary.ts` + its test — read sites, call sites, and
  attached blocks join the vocabulary; the block-skipping rule narrows to
  block *payloads*.
- `src/components/DocsDrawer.tsx` + `DocsDrawer.test.ts` — the wider payload.
- `src/reference/porting.ts` + crosschecks — the call-command renames and the
  value-returning call joining the false friends.
- `src/reference/compare.ts`, `portDescription.ts` + tests — read landings
  beside write landings; the machine-code finding among the rewrites with its
  posed decision.
- `docs/.vitepress/theme/components/DialectCompare.vue` — both findings.
- `src/ai/portReport.ts` — both join the hand-over.
- `e2e/porting-guidance/` — one browser assertion, extending an existing
  journey.

Reuses the posed-decision convention from the number-model proposal;
independent of the other siblings in code. The write-landings behaviour is
regression-guarded, not changed.

No dependency changes, no storage or share-format changes, no tokenizer
changes, and the machine reference the assistant's system prompt carries is
unchanged.
