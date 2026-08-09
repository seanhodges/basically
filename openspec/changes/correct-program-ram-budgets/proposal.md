## Why

The status bar's byte counter and the porting guide's "Free program RAM" row are
both drawn against one number per machine, and several of those numbers were
wrong — not slightly, and not in the safe direction.

The Acorn Atom was the worst. It reported an 8K budget. A real Atom shipped with
2K of RAM and takes 12K at most without an off-board expansion board, of which
5K is internal RAM and the floating-point ROM claims its first page: 4,864 bytes
for a BASIC program. The 8K figure matched neither that nor the emulator, which
had the opposite problem — the jsbeeb Atom model fills the whole of `0x0000` to
`0x9FFF` with RAM, so the emulated machine was carrying an expansion board and
had 22,272 bytes of program space. Three different answers, none of them the
machine's.

The two Acorn BBCs were quietly wrong the same way: 28K and 30K, where PAGE to
HIMEM in MODE 7 is 24.75K on the Micro (with the disc filing system's workspace
below it) and 27.5K on the Master. Both round numbers overstated the machine by
roughly 3K. The CPCs claimed 42,619, derived by assuming AMSDOS costs 370 bytes;
it lowers HIMEM by 1,284, and the machine's own `FRE(0)` reports 43,535 with no
disc ROM fitted.

What every one of these has in common is that nothing ever compared the figure
to the machine. The machines can all answer the question — each one already
reports live used/free from its own ROM pointers, which is what the status bar
switches to the moment a program runs — but the editor-time budget was
hand-written beside it and never checked against it.

## What Changes

- The Atom is emulated as the **12K machine it was**: block-zero RAM, 5K of
  internal RAM, 6K of video RAM, and open bus everywhere between. Writes to the
  address space it never populated no longer stick.
- Every machine's reported program size is **corrected to what the machine
  itself reports free** at its Ready prompt. The Atom drops from 8K to 4,864
  bytes; the BBC Micro from 28,672 to 25,344; the BBC Master from 30,720 to
  28,160; both CPCs rise from 42,619 to 43,535.
- The Atom's **memory map** shows the RAM the machine has and marks the rest as
  unfitted, the way the VIC-20's map already marks its absent expansion blocks.
  Its **block window** shrinks to the RAM a block can actually occupy.
- A **registry-driven check** boots every machine on its real ROM and compares
  its declared budget with its own cold-start reading, so a machine added with a
  guessed figure fails rather than ships.
- The Sinclair, Commodore, TRS-80 and Altair figures were checked and are
  **unchanged** — every one of them already matched its machine.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: the existing *The RAM budget is always visible* requirement
  gains what the budget has to be measured against — the machine's own free
  program RAM rather than a figure written beside it.
- `program-execution`: one requirement added — *A machine has only the memory it
  shipped with* — covering address space a machine does not populate.
- `memory-map`: the existing *The memory map accounts for the whole machine*
  requirement gains the distinction between memory a machine has and address
  space it merely addresses.

`memory-blocks` is **not** affected. Its *Runs are gated on block validity*
requirement already gates blocks on "the machine's legal ranges"; the Atom's
legal range becoming smaller is a change of data under an unchanged guarantee.

`porting-guidance` is **not** affected. It already states that each machine
answers with its own free-RAM figure; those figures becoming correct changes no
guarantee it makes.

## Non-goals

- **Emulating a 2K Atom, or making the Atom's RAM configurable.** The machine
  models one configuration — fully expanded, 12K — as the Altair models one 48K
  S-100 backplane. A RAM-size picker is a separate feature with its own
  questions (what the samples target, what a share link means), and nothing here
  needs it.
- **Changing the Sinclair budgets to their cold-start readings.** The ZX80 and
  ZX81 keep the display file inside the program area, where it grows as the
  screen fills; their budgets stay a screenful more conservative than the
  pointers, which is the honest figure for a program that prints anything.
- **Fitting AMSDOS on the CPC 6128.** The machine runs tape-only, which is why
  it reports the 464's figure. Fitting the disc ROM would lower it to 42,249 and
  is its own change.
- **A second, "real hardware" budget shown alongside the emulated one.** One
  number, and the machine decides it.

## Impact

- The Atom adapter takes the unfitted pages back out of jsbeeb's page table
  after every hard reset. jsbeeb itself is untouched, as the vendoring rules
  require.
- The Atom's address constants, memory map and block window move with it, and
  the kaleidoscope sample's machine-code block moves down into the RAM that
  exists. The maze and kaleidoscope samples stop using a fixed scratch address
  in the expansion window and `DIM` a buffer instead, which is what an Atom
  programmer would have done.
- The corrected figures propagate to the porting guide through the reference
  tree's own copy, which an existing crosscheck already pins to the dialects.
- The Atom hardware page explains the machine's three runs of RAM and the new
  block window.
