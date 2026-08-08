## Why

The ZX Spectrum 128 reads memory blocks **in** and cannot write them **out**.

Its `.TAP` import path resolves every CODE file on the tape into a block, by the
same shared helper the 48K uses. Its export path builds the tape from the
tokenized BASIC program alone: neither the `.TAP` target nor the cassette `.wav`
target declares that it carries blocks, so the Transfer dialog treats an export
as a lossy operation, asks the user to confirm dropping their machine code, and
then writes a tape without it.

Nothing about the machine justifies the asymmetry. The 128's tape format is
byte-for-byte the 48K's — its own build targets say so in a comment, and reuse
the 48K's tape encoder and `.TAP` writer unchanged, differing only in which
tokenizer produces the program bytes. The 128 also shares the 48K's memory-block
capability declaration wholesale, so blocks are created, edited and assembled on
the 128 exactly as on the 48K. The Kaleidoscope sample the 128 ships is the 48K's
program *and* the 48K's `$8000` machine-code block, imported verbatim: a user who
opens it, presses Run to watch it work, and then exports it to tape gets a tape
that no longer works, after a dialog telling them their code is being discarded.

This is a conformance gap rather than a missing feature. The `memory-blocks`
capability already guarantees that blocks travel with the document through
export. Two machines depart from that guarantee deliberately — the Amstrad CPC
and the Altair 8800, whose tape formats have no room for a second file, each
with the reasoning recorded where the targets are defined — and the spec has no
words for that distinction, so it reads as if all three machines were equally
in breach. The distinction is real and worth stating: an export carries blocks
wherever the machine's container format can hold them, and says so when it
cannot. Under that rule the CPC and Altair are correct, and the 128 is not.

## What Changes

- The ZX Spectrum 128's `.TAP` and cassette `.wav` exports **carry the
  document's memory blocks**, in the same multi-file layout the 48K already
  produces: one CODE file per block in address order, and the optional
  auto-loader leading the tape so a single `LOAD ""` on real hardware pulls in
  every block and runs the program.
- The Transfer dialog therefore **offers the 128 the auto-loader** and stops
  asking the user to confirm discarding blocks it can in fact carry.
- A 128 tape exported with blocks **imports back into the IDE intact** — source
  and every block — closing the round trip the machine could previously only
  travel one way.
- The `memory-blocks` spec **says what it already means**: blocks travel through
  export wherever the machine's format can carry them, and the user is told when
  it cannot. This legitimises the CPC and Altair rather than leaving them as
  silent exceptions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `memory-blocks`: one requirement modified — *Blocks are part of the document*.
  The clause about blocks travelling through export gains the container-capability
  qualifier it has always been read with, plus the obligation to tell the user
  when a chosen format cannot carry them. Two scenarios added: a block-carrying
  export round-trips, and a format that cannot carry blocks says so instead of
  dropping them quietly.

`hardware-transfer` is **not** affected: no new target, no new dialog control,
no change to how a target is chosen or how its files are downloaded. The
auto-loader checkbox and the blocks-are-dropped notice are existing behaviour
driven off the `supportsBlocks` flag; this change only makes two more targets
set it.

`program-execution` and `persistence` are **not** affected: blocks already load
into the 128's memory on Run and already survive autosave and the project
bundle. Only the export container changes.

## Non-goals

- **The Amstrad CPC and Altair 8800.** Their cassette formats carry the program
  area and nothing else; giving them block export would mean inventing a
  container their real hardware never had. The spec change here exists partly to
  record that this is correct behaviour, not an outstanding gap.
- **A 128-specific tape layout.** The 128 gets the 48K's layout because it is
  the same format. Anything the 48K's loader cannot express — bank-switched
  blocks above `$C000`, RAM-disc files, `.tzx` — is out of scope and would be
  its own change against the memory-block capability declaration first.
- **Blocks in the 128's other formats.** Only the `.TAP` and cassette `.wav`
  targets gain block support, because only they use the multi-file tape
  container.
- **Changing the shared loader.** The generated auto-loader is the 48K's,
  unchanged. If it turns out not to tokenize under the 128's own tokenizer, the
  fix is to let it be built with the caller's tokenizer, not to fork a second
  loader.
- **Reworking the block-drop confirmation.** The dialog's existing behaviour is
  right; this change just stops the 128 triggering it.

## Impact

Affected code:

- `src/dialects/zxspectrum128/targets.ts` — the tape layout gains the block and
  loader arms the 48K's already has, driven by the 128's own tokenizer as its
  program-bytes helper already is; both file targets declare `supportsBlocks`.
- `src/dialects/zxspectrum/loader.ts` — only if the generated loader source does
  not tokenize under the 128 tokenizer, in which case the tokenizer becomes a
  parameter. Expected to be unnecessary: the loader uses `CLEAR`, `LOAD ""
  CODE` and `LOAD ""` only.
- `src/dialects/blockExportRoundTrip.test.ts` — a 128 case beside the six
  already there, using the 128's own block-bearing Kaleidoscope sample. Its
  header comment, which still says the ZX Spectrum is the only block-aware
  export, is corrected while the file is open.
- `docs/reference/zxspectrum/formats.md` and `docs/reference/file-formats.md` —
  the 128 named where the 48K `.TAP` is described as carrying blocks in both
  directions.

No dependency changes. No new module, no seam change: `BuildTarget` already
carries `blocks`, `loader` and `supportsBlocks`, and the 128's targets simply
begin to honour them. No migration — a document with no blocks exports exactly
the tape it exports today.
