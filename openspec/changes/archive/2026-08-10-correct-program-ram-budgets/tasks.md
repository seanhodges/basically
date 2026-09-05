## 1. Constrain the Atom to a 12K machine

- [x] 1.1 Declare the fitted-RAM boundaries in the Atom's address facts: the top
      of block-zero RAM, the base of the internal RAM (the floating-point
      variables page), the top of the BASIC text space, and the top of the
      fitted video RAM.
- [x] 1.2 In the Atom adapter, mark the pages between those runs as device pages
      after initialisation, so writes are dropped and reads return open bus.
      Reapply after every hard reset — the Run path hard-resets before each
      injection, and jsbeeb rebuilds its page table from the model when it does.
      Do not touch the jsbeeb package.
- [x] 1.3 Point the Atom's live used/free reading at the top of the internal RAM
      instead of the screen base.
- [x] 1.4 Colocated emulator tests on the real ROMs: the machine still boots to
      its banner; a write sticks in each of the three fitted runs and does not
      stick in each of the three unfitted ones; and it is still unfitted after
      the reset a run performs.

## 2. The Atom's map, blocks, samples and budget

- [x] 2.1 Rebuild the Atom's memory map to the real machine: block-zero RAM, the
      expansion window, the floating-point variables page, the BASIC program
      area, the off-board extension RAM, the 6K of video RAM, the 2K above it
      the board never held, then the extension slot, I/O and ROMs. Mark the
      unfitted spans the way the VIC-20's map marks its absent expansion blocks.
- [x] 2.2 Shrink the block window to the internal RAM and move the default block
      address into it.
- [x] 2.3 Move the kaleidoscope sample's block down into the fitted RAM (source,
      assembly, the BASIC that pokes and LINKs it, and the fixtures that name
      the address), and replace the maze and kaleidoscope samples' fixed scratch
      address with a `DIM`-allocated buffer.
- [x] 2.4 Set the Atom's program-RAM budget to the internal RAM above the
      floating-point page, and mirror it into the reference tree.
- [x] 2.5 Update the Atom's colocated map and block tests to the new regions and
      window, including that the space between the fitted runs reads as unfitted.

## 3. The other corrected machines

- [x] 3.1 BBC Micro: PAGE (with the disc filing system's workspace below it) to
      HIMEM in MODE 7, derived from the existing address constants rather than
      restated as a literal.
- [x] 3.2 BBC Master: PAGE to HIMEM in MODE 7, likewise.
- [x] 3.3 Both CPCs: the program area from the BASIC program start up to HIMEM
      with no disc ROM fitted, which is what the machine's own `FRE(0)` reports;
      the 6128 takes the 464's figure rather than restating it.
- [x] 3.4 Mirror all four into the reference tree and update the compare test
      that pins the Master's figure.

## 4. Hold every machine to its own answer

- [x] 4.1 New registry-driven test: boot each machine on its real ROM, read free
      bytes at the Ready prompt, and check the declared budget against it —
      capped tightly above (never promise RAM the machine lacks) and allowed
      further below only for machines named with a reason.
- [x] 4.2 Name the machines that cannot be measured, with why, and assert they
      report nothing rather than skipping them silently.
- [x] 4.3 Confirm the Sinclair, Commodore, TRS-80 and Altair figures against
      their machines and leave them unchanged.

## 5. Documentation

- [x] 5.1 Atom hardware page: the machine's three runs of RAM, what BASIC gets,
      and the new block window. End-user prose, no internal paths.

## 6. Quality gates

- [x] 6.1 `npm run typecheck && npm test && npm run lint && npm run format:check`
- [x] 6.2 `npm run docs:build` (the Atom hardware page changed)
- [x] 6.3 `npm run e2e:chromium -- e2e/memory-map` (the Atom's regions moved)
- [x] 6.4 `npm run e2e:chromium -- e2e/memory-blocks` (the Atom's block window
      and default address moved)
- [x] 6.5 `npm run e2e:chromium -- e2e/code-editor` (the byte-budget readout)
