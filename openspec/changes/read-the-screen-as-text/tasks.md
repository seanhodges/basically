## 1. The seam

- [x] 1.1 Add `MachineScreenText` (`lines`, `cols`, `rows`) and the optional
      `readScreenText?(): MachineScreenText | null` member to
      `src/dialects/types.ts`, documented like the other optional introspection
      members: detected via `typeof`, `null` means "cannot determine now" and a
      blank screen is spaces, and OCR machines report what the stock font says.
- [x] 1.2 Add the screen-code → charset-byte inverse the Commodore readers need
      beside `petsciiToScreen` in `src/dialects/glyphSources.ts`, with cases in
      `glyphSources.test.ts` pinning it as the exact inverse over every code
      `petsciiToScreen` maps.
- [x] 1.3 Add a cross-machine font-signature matcher under `src/emulator/`
      (signature map builder + a matcher taking a per-cell supplier of eight
      1-bpp mask bytes), with a colocated test covering an exact hit, an
      unmatched cell reading as a space, and space winning a signature clash.

## 2. Character-matrix machines

Each task: implement `readScreenText()` deriving its base from the machine's own
registers/system variables (never a constant), decode through the dialect
charset, and add colocated `*.test.ts` cases for a known program's output, a
blank screen reading as spaces, and `null` before the machine is up.

- [x] 2.1 TRS-80 (`src/dialects/trs80/interpreter/machine.ts`) — 64×16 from the
      interpreter's video array. Simplest machine; do it first to settle the
      shape the rest follow.
- [x] 2.2 PET (`src/emulator/pet/petMachine.ts`) — 40×25 at `$8000`.
- [x] 2.3 C64 (`src/emulator/c64/c64Machine.ts`) — 40×25, base from the VIC-II
      register, with a test that moves the matrix and still reads it back.
- [x] 2.4 VIC-20 (`src/emulator/vic20/vic20Machine.ts`) — 22×23, base and
      geometry from the VIC-I registers, same moved-matrix test.
- [x] 2.5 Atom (`src/emulator/atom/atomMachine.ts`) — 32×16 VDG matrix at
      `$8000`; confirm the VDG code layout against the ROM before mapping it,
      and cover an inverse-video cell.

## 3. Display-file machines

- [x] 3.1 ZX81 (`src/dialects/zx81/emulator/zx81Machine.ts`) — walk from
      `D_FILE`, padding short rows to 32 characters and the file to 24 rows.
      Colocated tests: a printed line, a collapsed display file, and a screen
      holding ZX81 graphics characters decoding to the same Unicode a listing
      shows.
- [x] 3.2 ZX80 (`src/dialects/zx80/emulator/zx80Machine.ts`) — the same walk
      against the ZX80 charset, with its own colocated tests.

## 4. Bitmap machines

- [x] 4.1 Spectrum (`src/dialects/zxspectrum/emulator/spectrumMachine.ts`) —
      32×24 OCR against the ROM font, using the shared matcher. Colocated tests
      including the boot copyright line.
- [x] 4.2 Spectrum 128 (`src/dialects/zxspectrum128/emulator/spectrum128Machine.ts`)
      — the same, read through `mem.readScreen` so the shadow screen resolves;
      test both screen pages.
- [ ] 4.3 CPC 464 and 6128 (`src/emulator/cpc/cpcMachine.ts`) — OCR against the
      lower-ROM font with the 2-bpp unpacker as the matcher's supplier; geometry
      per MODE. Confirm the font base against the real ROM. Colocated tests for
      MODE 1 and one other mode.
- [ ] 4.4 BBC Micro / Master (`src/emulator/bbc/bbcMachine.ts`), mode 7 —
      teletext RAM, base derived so hardware scroll is followed; test a scrolled
      screen.
- [ ] 4.5 BBC modes 0–6 — read the mode from the MOS VDU variables and OCR with
      the MOS font at that mode's geometry and pixel depth, accounting for the
      blank scanline gaps in modes 3 and 6. Confirm every address and layout
      against the real ROM and primary documentation. Colocated tests for one
      mode at each pixel depth (e.g. 6, 1, 2). Any mode that cannot be verified
      returns `null` and the gap is noted in the task list rather than guessed.

## 5. Migrate the tests off the seam

Delete each helper and re-express its assertions against `readScreenText()`,
one machine at a time, only after that machine's own reader tests pass.

- [ ] 5.1 TRS-80: `screenRow` in `src/dialects/trs80/interpreter/machine.test.ts`.
- [ ] 5.2 Atom: `screenText` in `src/dialects/atom/atom.test.ts`,
      `src/dialects/atom/samples.test.ts`, `src/emulator/atom/atomMachine.test.ts`,
      and `findPlayer` in `samples.test.ts` (becomes a search over `lines`).
- [ ] 5.3 Acorn: `screenText` in `src/emulator/bbc/bbcMachine.test.ts`,
      `bbcMachine.blocks.test.ts`, `bootDisc.test.ts`,
      `src/dialects/bbcmicro/samples.test.ts`, `src/dialects/bbcmaster/bbcmaster.test.ts`.
- [ ] 5.4 Sinclair: `firstTextRow` in
      `src/dialects/zx80/emulator/zx80Machine.test.ts`, `findPlayer` in
      `src/dialects/zx80/samples.test.ts`, `readScreen`/`screenRows` in
      `src/dialects/zxspectrum/emulator/spectrumMachine.test.ts`, `readScreen` in
      `src/dialects/zxspectrum128/emulator/spectrum128Machine.test.ts`.
- [ ] 5.5 CPC: `ocr` in `src/emulator/cpc/cpcBoot.test.ts` and
      `src/emulator/cpc/cpc6128Boot.test.ts`.
- [ ] 5.6 Confirm the deliberate non-migrations are still in place and still
      justified: `screenCodes(machine)` in `src/dialects/atom/semigraphics.test.ts`
      and `screen(m)` in the PET/VIC-20/C64 tests assert on encoding, and
      `screenMem(rows)` in `src/emulator/c64/reports.test.ts` builds input.
- [ ] 5.7 Add a registry-level test asserting every registered dialect's machine
      implements `readScreenText`, so a new machine cannot silently omit it.

## 6. Quality gates

- [ ] 6.1 `npm run typecheck`
- [ ] 6.2 `npm test`
- [ ] 6.3 `npm run lint`
- [ ] 6.4 `npm run format:check` (or `npm run format`)
- [ ] 6.5 `npm run e2e:chromium -- e2e/program-execution` — the modified
      capability. Nothing user-visible changes, so this is a regression check on
      the machines being edited; check off only when the run passes, and on
      failure leave it unchecked with a note on what failed.
- [ ] 6.6 `npx openspec validate --changes`
