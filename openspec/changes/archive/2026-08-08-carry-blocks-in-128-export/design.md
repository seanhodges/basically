## Context

The 48K Spectrum's block export shipped as the first block-aware export in the
project and set the pattern the Commodore, BBC, Atom and TRS-80 exports followed.
The 128 was built alongside it from the 48K's tape code but predates the block
work, and was never revisited: it reuses the 48K's `.TAP` writer and cassette
encoder while keeping its own copy of the "build the program bytes, wrap them in
a tape" glue — the copy that block support was added to on the 48K side and not
here.

See `docs/contributing/architecture.md` for the dialect seam; this change does
not alter it.

## Goals / Non-Goals

**Goals**

- The 128's tape exports carry blocks with the same layout, ordering and loader
  semantics as the 48K's, so a tape written by either machine is the same shape.
- The shared tape primitives stay shared. No second implementation of the
  layout, the CODE-file encoding or the loader.
- The spec gains the words for a distinction it already relies on: some
  containers cannot carry blocks, and that is a designed answer, not a gap.

**Non-Goals**

- Any 128-only tape capability (banked blocks, RAM disc, `.tzx`).
- Unifying the 128 and 48K target modules. They are deliberately separate so
  each drives its own tokenizer; see the decision below.

## Decisions

### The layout function is shared, the tokenizer is not

The 48K exposes its tape layout as a function over *program bytes* plus blocks
plus a loader flag, and its `.TAP` and `.wav` targets both consume it — that is
what keeps the two formats in step. The 128's need is the same function with
different program bytes.

**Decision: extract nothing; give the 128 the same arms over its own tokenizer.**
The 128's targets module already exists precisely so the 128 tokenizes with the
128 tokenizer while sharing the tape primitives below it (`tapBlocks`,
`codeTapBlocks`, `tapImageFromBlocks`, `encodeSpectrumTape`). The block and
loader arms are a handful of lines over those same primitives, and the round-trip
test is what holds the two layouts identical.

*Alternative considered:* lift the layout into a shared module parameterised by a
tokenizer. Rejected for now — it trades a small, test-pinned duplication for a
seam whose only two callers are these, and the 128 module's existing comment
already explains why the duplication is deliberate. Worth revisiting only if a
third Spectrum variant appears.

### The loader stays the 48K's, unless it doesn't tokenize

The auto-loader is generated BASIC — `CLEAR`, one `LOAD "" CODE` per block, a
final `LOAD ""` — tokenized by the 48K tokenizer and shipped as its own tape
file. Every keyword in it is core Sinclair BASIC present in both dialects, so
the 128 can use it as-is and a loader-led 128 tape is byte-comparable with the
48K's.

**Decision: use it unchanged, but verify rather than assume.** If the 128
tokenizer produces different bytes for that source, take the tokenizer as a
parameter with the 48K's as the default. Do not fork a second loader: two
generators of the same BASIC would drift.

### The spec change is a clarification, not new behaviour

The baseline already requires blocks to travel through export. On the strict
reading the 128 breaks it and the CPC and Altair break it too — but those two
are correct, because their tape formats hold one program and nothing else.

**Decision: modify the existing requirement to carry the qualifier, rather than
add a new requirement for the 128.** The guarantee the product actually makes is
*blocks travel wherever the container can hold them, and you are told when it
cannot* — which is exactly what the Transfer dialog implements. Writing that
down turns the CPC and Altair from silent exceptions into conforming machines
and leaves the 128 as the only violation, which is the point of the change.

*Alternative considered:* no spec delta at all, treating this as a pure bug fix.
Rejected because the requirement as written would still misdescribe two shipped
machines, and the next reader would find the same ambiguity.

## Risks / Trade-offs

- **The loader's `CLEAR` address on a 128.** The loader clears below the lowest
  block, which is the right gesture on both machines, but 128 memory above
  `$C000` is banked. A block placed there would be loaded into whichever bank is
  paged at export time — a pre-existing property of the block model on this
  machine, not something this change introduces, and out of scope per the
  proposal. The block linter's existing range checks are what would catch an
  impossible address.
- **Duplication between the two targets modules** grows by the block and loader
  arms. Mitigated by the round-trip test covering both machines through the same
  harness; if they drift, that is where it shows.
- **Tape ordering is load-bearing.** Loader first, CODE files in address order,
  main program last: the loader's final `LOAD ""` chains into whatever comes
  next. Getting the order wrong produces a tape that imports back perfectly and
  fails on real hardware, which the round-trip test cannot see. Mirroring the
  48K's arm exactly is the mitigation; a manual check in an external emulator is
  the verification.

## Migration Plan

None. Documents with no blocks export the same tape bytes as before — the
no-blocks arm is untouched. Documents with blocks previously could not export
them at all, so there is no prior artifact whose shape changes.

## Open Questions

- Should the 128's `.TAP` gain a `.tzx` sibling later for anything the `.TAP`
  container cannot express? Out of scope here, and only worth asking once
  something concrete needs it.
