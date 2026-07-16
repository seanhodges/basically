# Memory blocks — machine code & data implementation plan

> A dependency-ordered, multi-stage plan to make machine code and data blocks
> first-class document content: created and edited in the IDE, referenced from
> BASIC, loaded into the emulator on Run, and carried through import/export.
> Each stage is a medium, single-session task for the coding agent and leaves
> the app shippable (typecheck/test/lint/format green, no half-wired UI). Run
> stages in order; ZX Spectrum ships first, other dialects follow by format
> affinity.

## Problem

The IDE treats a document as a single string of BASIC source. Everything
downstream assumes BASIC-only: autosave persists `{fileName, source}`; Run does
`dialect.tokenize(source)` → `machine.loadProgram(result.image)`
(`src/components/EmulatorPane.tsx`); export goes through
`BuildTarget.build(source, { programName })`; and importers parse out only the
BASIC program — the Spectrum `.TAP` importer even detects CODE blocks and then
discards them with a warning (`parseTapWithReport`). Machine code and data that
real programs load alongside BASIC are invisible to the IDE.

## Design decisions (fixed)

- **First dialect: ZX Spectrum** (`src/dialects/zxspectrum/`, shared by
  `zxspectrum128`). `.TAP` is natively multi-block; CODE files with load
  addresses are the authentic mechanism, so import/export round-trips with zero
  format invention.
- **Editing model:** the hex/ascii editor is the write path first; the assembly
  tab starts as read-only disassembly; a full edit-assemble assembler is a
  later stage of this same plan.
- **BASIC referencing: both** plain addresses with autocomplete and symbolic
  `@name` refs substituted in an app-level pre-pass (IDE-side syntax;
  detokenize/import emits plain numbers).
- **Tabs, not dialogs:** the hex editor and assembly view are fully responsive
  tabs in the editor area — the first real editor-pane tab system (today there
  is exactly one `CodeMirrorHost` and only the mobile pane switcher).

## Key facts the plan builds on

- **Seam:** `Dialect` / `MachineEmulator` in `src/dialects/types.ts`.
  `loadProgram(image)` is the only injection API; no public memory read/write,
  but every core has an internal primitive (Spectrum `memory.write`, jsbeeb
  `cpu.writemem`, viciious `wires.cpuWrite`, 6502 `BusInterface.poke`,
  `Zx81Memory.write`, `Trs80Memory.write`). Optional emulator methods are
  feature-detected (`typeof m.x === 'function'`).
- **Spectrum:** `tapfile.ts` already has `tapFromPayloads` and block scanning;
  `spectrumMachine.loadProgram` injects via the ROM tape trap then types
  `RUN` — a window exists between LOAD completing and RUN for direct block
  writes.
- **UI:** store uses a counter/seq command-bus; hex prior art in
  `src/storage/vfs/hexdump.ts` + `VfsInspectorDialog`; `charset.glyph(code)`
  gives per-byte glyphs (charsets are total over 0x00–0xFF).
- **CPU tooling in-tree:** two vendored 6502 disassemblers exist (viciious
  `tools/disasm.js`, public domain, unused; jsbeeb `Disassemble6502`). No Z80
  disassembler or any assembler exists in-tree; see the library survey under
  Stages 6 and 11. Vendored cores are "don't touch"; wrap in adapters only.
- **Tests convention:** colocated `*.test.ts`; `roundTripHarness.ts` /
  `roundTrip.test.ts` / per-dialect `foreignRoundTrip.test.ts`. Gate:
  `npm run typecheck && npm test && npm run lint && npm run format:check`.

## Status legend

✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked

| Stage | Title                                                | Status |
| ----- | ---------------------------------------------------- | ------ |
| 1     | Data model & persistence                             | ⬜     |
| 2     | Dialect metadata, editor tabs, read-only hex viewer  | ⬜     |
| 3     | Editable hex editor + raw `.bin` per-block load/save | ⬜     |
| 4     | Emulator loading (Spectrum)                          | ⬜     |
| 5     | Spectrum `.TAP` import/export of CODE blocks         | ⬜     |
| 6     | Assembly view (read-only) + Z80 disassembler         | ⬜     |
| 7     | BASIC integration: `@name` refs, completions, lint   | ⬜     |
| 8     | Rollout: C64 / VIC-20 / PET                          | ⬜     |
| 9     | Rollout: BBC, ZX81/ZX80, Atom, TRS-80                | ⬜     |
| 10    | Share links & player                                 | ⬜     |
| 11    | Assembler (Z80 first, then 6502)                     | ⬜     |
| 12    | Docs                                                 | ⬜     |

---

## Stage 1 — Data model & persistence ⬜

A `MemoryBlock` document model that survives reload (autosave) and Save/Open (a
concrete on-disk project format), with correct dirty/New/Open/Save semantics.
Invisible in the UI; nothing changes for pure-BASIC documents.

- [ ] `src/dialects/types.ts` — add the shared type:

  ```ts
  export interface MemoryBlock {
    id: string; // stable UI id, not semantic
    name: string; // /^[A-Za-z][A-Za-z0-9_]*$/, unique per document
    address: number;
    bytes: Uint8Array;
    kind: 'code' | 'data';
    comment?: string;
  }
  ```

- [ ] `src/app/store.ts` — `blocks: readonly MemoryBlock[]` +
      `setBlocks`/`upsertBlock`/`removeBlock` (each sets `dirty`); reset blocks
      in `loadUnsavedDocument`/`replaceDocument`/dialect switch/`playerBoot`;
      optional `blocks?` opt on the load actions so Open/Import installs blocks
      atomically with the source; `persistAutosave()` signature string includes
      a blocks digest so block edits autosave.
- [ ] `src/storage/settings.ts` — `mbide.autosave.blocks` key;
      `saveAutosave(name, text, blocks)` / `loadAutosave()` with base64 bytes
      (`src/storage/vfs/base64.ts`); defensive parse → `[]` on corrupt data.
- [ ] New `src/storage/projectFile.ts` — the on-disk bundle:
      `ProjectFileV1 { format: 'basically-project', version: 1, dialect, source, blocks: SerializedBlock[] }`
      with `serializeProject` / `parseProject` (throws on malformed input,
      import-style path) / `isProjectFile` (cheap sniff).
- [ ] `src/app/fileCommands.ts` + `src/storage/files.ts` — **format decision:
      plain `.txt` stays for pure-BASIC documents; Save writes a `.bproj` JSON
      bundle when blocks exist** (human-readable, diffable, single file, no zip
      dependency). Open accepts `.bproj` alongside `.txt`/`.bas` and sniffs
      project-shaped `.txt`; `openDroppedFile` gains a `.bproj` branch.
- [ ] Tests: `projectFile.test.ts` (round-trip, malformed JSON, wrong `format`,
      version gate); settings autosave round-trip; store tests (block actions
      set dirty; New/Open/dialect-switch clear blocks; autosave signature
      includes blocks).

**Depends on:** nothing.
**Verify:** full gate; seed a block via console in dev, reload → restored;
Save produces `.bproj`; Open restores it.

## Stage 2 — Dialect metadata, editor tabs, read-only hex viewer ⬜

The first editor-area tab system, gated on a per-dialect capability, with block
create/delete/metadata editing and a read-only hex/ascii view. Non-Spectrum
dialects see no change.

- [ ] `src/dialects/types.ts` — optional capability on `Dialect`:

  ```ts
  export interface MemoryBlocksSupport {
    cpu: 'z80' | '6502';
    validRanges: readonly MemoryRange[]; // legal block addresses (RAM)
    reservedRanges: readonly MemoryRange[]; // warn (screen, sysvars…)
    programArea(programByteSize: number): MemoryRange; // collision check
    defaultAddress: number; // suggested for new blocks
  }
  ```

- [ ] New `src/dialects/zxspectrum/memoryBlocks.ts` — 48K figures: valid
      `0x4000–0xFFFF`; reserved: display `0x4000–0x5AFF`, attributes + printer
      buffer `0x5B00–0x5BFF`, sysvars `0x5C00–0x5CCA`; `programArea` from
      PROG = 23755 (`0x5CCB`) plus a documented slack margin (~768 bytes) for
      the variables area; `defaultAddress: 0x8000`. Wire into
      `zxspectrum/index.ts` (`zxspectrum128` inherits).
- [ ] `src/app/store.ts` — `editorTab: 'basic' | 'hex' | 'asm'`,
      `activeBlockId: string | null`; reset on document loads and dialect
      switch; `removeBlock` fixes up `activeBlockId`.
- [ ] New `src/components/EditorTabs.tsx` — slim tab strip at the top of
      `.editorPane`, rendered only when `dialect.memoryBlocks` exists.
- [ ] New `src/components/MemoryTab.tsx` — block selector (list on desktop
      widths, dropdown on narrow), "New block…" form validated against
      `memoryBlocks`, metadata editing, delete-with-confirm, hex grid below.
- [ ] New `src/components/HexGrid.tsx` — read-only this stage: address gutter,
      hex cells, ascii column via `dialect.charset.glyph(byte)`. Hand-rolled
      row windowing (blocks ≤ 48 KB; no dependency); bytes-per-row 16/8/4 from
      container width via ResizeObserver.
- [ ] `src/components/Workspace.tsx` — keep `CodeMirrorHost` **always
      mounted**, toggle `display:none` (preserves EditorView state, undo, the
      `docOverride` seq channel). Editor tabs live _inside_ the editor pane so
      they compose with the mobile pane switcher on phones.
- [ ] New `src/app/blockLint.ts` —
      `lintBlocks(blocks, support, programByteSize): BlockIssue[]`. Errors:
      outside `validRanges`, block–block overlap, program-area overlap,
      duplicate/invalid names. Warnings: reserved-range overlap. Badges in
      `MemoryTab` + an error dot on the tab strip.
- [ ] Tests: `blockLint.test.ts` (all collision classes, boundary off-by-ones),
      `memoryBlocks.test.ts`, windowing math extracted to a pure helper +
      test. New `e2e/memory-blocks.spec.ts` (strip appears on Spectrum only;
      create a block; tab switch preserves editor content); confirm
      `e2e/landscape-layout.spec.ts` still passes.

**Design notes:** fixed tabs (BASIC | Memory | Asm-later) with a block selector
inside — not tab-per-block (unbounded strips on phones). Custom React grid, not
CodeMirror, for hex: a fixed-geometry, two-column, overwrite-mode surface
fights CodeMirror's text model. `formatHexDump` stays as-is for the VFS
inspector.

**Depends on:** Stage 1.
**Verify:** full gate + e2e; phone-portrait viewport — tab strip fits, grid
drops to 8 columns.

## Stage 3 — Editable hex editor + raw `.bin` per-block load/save ⬜

- [ ] `HexGrid.tsx` — cell selection + caret; hex column nibble-wise
      **overwrite** editing (`0–9a–f`, high then low nibble, auto-advance);
      ascii column via `charset.toMachine` (unmappable → ignore + status
      flash); arrow/PageUp/Home navigation. Edits go through `upsertBlock`
      with a fresh `bytes` array (immutable updates keep Zustand semantics).
- [ ] `MemoryTab.tsx` — resize (grow pads with a fill byte, shrink confirms),
      "Fill selection…", "Load bytes from file…" (replaces block bytes),
      "Save block as `.bin`" (plain byte download; _addressed_ formats arrive
      in Stage 5).
- [ ] New `src/components/hexEditing.ts` — pure editing model (apply-nibble,
      apply-char, resize, fill) unit-testable without DOM.
- [ ] Bounded per-block undo/redo in component state (byte edits only, cleared
      on block switch). Deliberately not global — CodeMirror owns BASIC undo.
- [ ] Touch: tapping a hex cell focuses a hidden input and an on-screen hex
      keypad row (0–F) renders under the grid on touch devices.
- [ ] Tests: `hexEditing.test.ts` (nibble sequencing, charset round-trip,
      resize/fill edges); e2e: edit a byte, switch tabs, reload — byte
      persists.

**Design note:** overwrite-only (no mid-block insert/delete) keeps addresses
stable and matches classic hex editors; resize is the explicit size gesture.

**Depends on:** Stage 2.
**Verify:** full gate + e2e; tap targets ≥ 32 px on touch.

## Stage 4 — Emulator loading (Spectrum) ⬜

Run loads the complete program: BASIC via the existing tape path, blocks
written into memory before RUN.

- [ ] `src/dialects/types.ts` — extend (backward compatible; one-arg
      implementations still satisfy the type):

  ```ts
  loadProgram(image: Uint8Array, opts?: { blocks?: readonly MemoryBlock[] }): void;
  ```

- [ ] `src/dialects/zxspectrum/emulator/spectrumMachine.ts` — after the LOAD
      trap completes and **before** typing RUN, write each block via
      `this.memory.write` (established pattern — `clearScreen` already
      direct-writes). When a block sits below default RAMTOP, type
      `CLEAR <minAddr-1>` before RUN via `tapKeys` so the BASIC stack cannot
      clobber it (mirrors what a real loader does).
- [ ] `src/components/EmulatorPane.tsx` — narrow selector for `blocks`; run
      `lintBlocks` first and gate the run on severity-`error` issues exactly
      like the existing lint gate (status notice names the block); pass
      `{ blocks }` when non-empty.
- [ ] Tests: machine test — block at `0x8000` present after boot;
      `10 PRINT PEEK 32768` reflects it; CLEAR case with a high block intact
      after a program that assigns variables.

**Design note:** direct write for the emulator path (deterministic, instant);
the authentic multi-block TAP is the _export_ story (Stage 5). No public
`writeMemory` on the seam yet — `loadProgram` is its only consumer; a
feature-detected read/write pair can come later if a live-memory view is
wanted.

**Depends on:** Stages 1–2 (3 recommended).
**Verify:** full gate. Manual smoke (recurring): block `border` at 32768 =
`3E 02 D3 FE C9` (`LD A,2 / OUT (0xFE),A / RET`), BASIC
`10 RANDOMIZE USR 32768` → red border. Works on `zxspectrum128` too.

**Risks:** 128K paging — blocks address the boot-time 48K-compatible map;
document, don't solve. Verify `CLEAR` keystroke timing on both ROMs.

## Stage 5 — Spectrum `.TAP` import/export of CODE blocks ⬜

Export produces a multi-file `.TAP` loadable on real hardware; import turns
CODE files into memory blocks instead of discarding them. WAV export carries
the same blocks.

- [ ] `tapfile.ts` — `codeTapBlocks(name, address, bytes)` (header type 3,
      param1 = address, param2 = 0x8000 per convention);
      `buildMultiTap(files)`; `parseTapAllFiles(image)` →
      `{ program, code[], warnings }` (arrays still skipped with a warning;
      headerless data blocks warned).
- [ ] `src/dialects/types.ts` —
      `BuildTarget.build(source, { programName; blocks? })`;
      `DetokenizeResult` gains `blocks?: MemoryBlock[]`.
- [ ] `zxspectrum/targets.ts` — multi-file TAP. **Auto-loader checkbox,
      default ON when blocks exist:** TAP order is an auto-run loader BASIC
      (`CLEAR min-1 : LOAD "" CODE : … : LOAD ""`), CODE files in address
      order, then the main program auto-starting at its first line. Without
      the loader: main program (load-only) first, CODE files after, and a
      Transfer-dialog notice when the source contains no `LOAD "" CODE` of its
      own. The user's program is untouched in both modes. WAV target encodes
      the same block list.
- [ ] Import — detokenizer/report uses `parseTapAllFiles`: CODE files become
      blocks (name from `headerName`, `kind: 'code'` default); a loader-shaped
      first program followed by a payload program imports the payload and
      warns about the skipped loader. `src/app/importProgram.ts` plumbs
      `blocks` through to `loadUnsavedDocument`.
- [ ] `TransferDialog.tsx` — pass store blocks into `build`; loader checkbox
      (Spectrum tap/wav only).
- [ ] Tests: tapfile additions (CODE header layout, multi-file scan, param1
      round-trip); a blocks-aware `importRoundTripWithBlocks` helper in
      `roundTripHarness.ts`; build → import round-trip equality.

**Depends on:** Stages 1–4.
**Verify:** full gate. Manual: exported TAP runs in an external emulator
(e.g. Fuse) — auto-loader runs, border flips; re-import and drag-drop restore
source + block.

## Stage 6 — Assembly view (read-only) + Z80 disassembler ⬜

An "Asm" tab showing disassembly of the active `kind: 'code'` block, behind a
per-CPU `Disassembler` interface in a new `src/asm/` module.

- [ ] New `src/asm/types.ts` —
      `DisassembledLine { address, bytes, text }`;
      `type Disassembler = (bytes: Uint8Array, origin: number) => DisassembledLine[]`.
- [ ] New `src/asm/registry.ts` — `disassemblerFor(cpu)` (`'6502'` returns
      null until Stage 8).
- [ ] New `src/asm/z80/` — the Z80 disassembler. **Library survey (July
      2026):** [z80-disasm](https://github.com/lkesteloot/z80-disasm) is a
      solid MIT TypeScript disassembler (JSON opcode tables; standalone repo
      archived, continued inside the author's `trs80` monorepo);
      [z80js](https://github.com/viert/z80js) bundles one with a debugger.
      **Approach: adapt/vendor `z80-disasm` (MIT) following the repo's
      vendoring convention (`LICENSE-*.md` alongside, like `z80core` /
      `viciious`), wrapped behind `Disassembler`.** Fall back to writing a
      table-driven one from scratch only if adaptation proves awkward —
      either way the gotchas to test: CB/ED/DD/FD prefixes, DDCB/FDCB
      (displacement byte _before_ the final opcode), JR/DJNZ shown with
      absolute targets, ED holes as `DB`, truncated tail handling.
- [ ] New `src/components/AsmView.tsx` — read-only windowed listing
      (address | bytes | mnemonic); selector restricted to `kind: 'code'`
      blocks; "edit bytes in the Memory tab" hint. Asm tab visible when the
      dialect is supported, a disassembler exists for its CPU, and at least
      one code block exists.
- [ ] Tests: golden encodings across every prefix family (`ED B0 → LDIR`,
      `DD CB 03 46 → BIT 0,(IX+3)`, `18 FE → JR $` target math, truncated
      instruction at end).

**Depends on:** Stage 2.
**Verify:** full gate; the border-flip block disassembles to
`LD A,2 / OUT (0FEh),A / RET`; e2e: create a code block → Asm tab appears.

## Stage 7 — BASIC integration: `@name` refs, completions, lint ⬜

BASIC source may write `RANDOMIZE USR @border`; the IDE substitutes the
address everywhere bytes are produced; completions and lint understand blocks.
Detokenize/import continues to emit plain numbers.

- [ ] New `src/editor/blockRefs.ts` — the single substitution implementation:
      `resolveBlockRefs(source, blocks)` → `{ source, errors, mapColumn }`
      (unknown `@name` = fatal `TokenizeError` at its position; scanner skips
      string literals and REM tails, dialect-neutral);
      `blockRefWarnings(source, blocks, usrKeywords)` — "USR 32768 matches no
      block", non-fatal.
- [ ] New `src/app/buildSource.ts` — `resolveForDialect(dialect, source, blocks)`,
      the **single** substitution point ahead of every `dialect.tokenize`:
      run path (`EmulatorPane`), export (`TransferDialog` / target `build`),
      lint (`lintIntegration.ts` reads blocks imperatively inside the
      debounced callback — no extension rebuild on block edits — and remaps
      diagnostic columns via `mapColumn`), byte counter (`useProgramStats`).
- [ ] `CodeMirrorHost.tsx` — extra completion source (own Compartment): block
      names after `@`, and `@name`/address completions after `USR` (dialect
      keyword list; generalizes to `SYS`/`CALL` in the rollout stages). Info
      popup shows address + size + comment.
- [ ] `src/share/compatibility.ts` + `ShareLinkDialog.tsx` — documents with
      blocks or `@` refs flagged not-shareable with a clear notice until
      Stage 10.
- [ ] Tests: substitution, strings/REM immunity, unknown-name error position,
      `mapColumn` across multiple refs per line, unmatched-address warnings;
      lint integration test that the squiggle lands on the `@name` token; run
      path test that `10 RANDOMIZE USR @border` tokenizes cleanly.

**Design note:** substitution at the app layer, not inside each dialect's
tokenizer — all 11 tokenizers stay untouched, one tested implementation,
composes with the errors-not-throws convention.

**Depends on:** Stages 1–2 (4 for a satisfying demo).
**Verify:** full gate; typing `@` completes block names; renaming a block
lints the stale ref; the border sample written with `@border` runs.

## Stage 8 — Rollout: C64 / VIC-20 / PET ⬜

- [ ] `memoryBlocks.ts` per dialect — `cpu: '6502'`. C64: valid
      `0x0800–0xFFFF`, reserved zero page/stack/screen and the IO-banked
      `0xD000` area (warn), `programArea` from `0x0801`, default `0xC000`.
      VIC-20/PET: conservative base-RAM figures (expansions documented, not
      modeled).
- [ ] Injection in the adapters only: viciious `wires.cpuWrite`, PET/VIC-20
      `BusInterface.poke`, after BASIC injection, before the auto-RUN.
- [ ] New `src/asm/mos6502/` — wrap the vendored, public-domain, currently
      unused `src/emulator/c64/viciious/tools/disasm.js`
      (`disasm(cpuRead, addr, to)`) behind `Disassembler` via a closure over
      the block bytes; register for `'6502'`. (Preferred over jsbeeb's
      `Disassemble6502` here because it is already vendored and
      dependency-free; jsbeeb's stays an option for the BBC stage.)
- [ ] Export: **one `.prg` per block** (2-byte load address + bytes,
      `name.prg`) alongside the BASIC `.prg` — authentic
      (`LOAD "name",8,1`), no zip dependency. Import: a `.prg` whose load
      address is not the BASIC start (or one dropped while a program is open)
      imports as a block; multi-`.prg` drop supported.
- [ ] `@`-ref keyword: `SYS`.
- [ ] Tests: blocks-aware round-trip per dialect; adapter injection tests
      (PEEK a block byte); 6502 disassembler goldens (`A9 02 → LDA #$02`,
      `8D 20 D0 → STA $D020`, `60 → RTS`).

**Depends on:** Stages 1–7.
**Verify:** manual recipe — block `A9 02 8D 20 D0 60` at 49152,
`10 SYS 49152` → C64 border red.

## Stage 9 — Rollout: BBC, ZX81/ZX80, Atom, TRS-80 ⬜

One shippable sub-stage per dialect, in this order, each with the honest
per-format story:

- [ ] **BBC Micro/Master** — PAGE-based `programArea`; blocks in mode-dependent
      `0x0E00–0x7FFF` with a display-mode warning; inject via jsbeeb
      `cpu.writemem`; disassembler = the Stage-8 wrapper (or jsbeeb's
      `Disassemble6502`, GPL-compatible, imported not forked); export raw
      memory files + `*RUN` guidance. Docs note that BBC BASIC's genuine
      inline `[ ]` assembler already works in the emulator — blocks complement
      it for pre-built binaries. Keywords: `CALL` / `USR`.
- [ ] **ZX81/ZX80** — emulator injection anywhere in RAM via
      `Zx81Memory.write`; but the standard `.P`/`.O` snapshot **cannot carry
      above-RAMTOP data** (it spans `0x4009` → E_LINE only). Export blocks as
      sidecar `name-<addr>.bin` files with a Transfer-dialog notice; no
      nonstandard `.P` variant (compatibility with real tooling wins). The
      classic REM-line convention (code inside line 1 at 16514) needs no block
      and stays the documented fully-portable route — add a guide recipe.
- [ ] **Atom** — one `.atm` per block with real load/exec addresses; relax
      `stripAtmHeader`'s throw so a non-`#2900` `.atm` imports as a block
      instead of erroring. Inject via `cpu.writemem`.
- [ ] **TRS-80** — inject via `Trs80Memory`; export blocks as SYSTEM-format
      `.cas` (name/address records); Z80 disassembler reused from Stage 6.
      Keywords: `USR` / `DEFUSR`.

**Depends on:** Stages 1–8.
**Verify:** per dialect — metadata tests, injection PEEK test, format
round-trip, one manual border/screen-poke recipe each.

## Stage 10 — Share links & player ⬜

- [ ] `src/share/shareClient.ts` — wire contract v2: optional
      `blocks: SerializedBlock[]` (reuse the `projectFile.ts` serialization);
      the 64 KB limit now includes base64 blocks — fail with a clear
      over-limit message.
- [ ] `src/share/compatibility.ts` — drop the Stage-7 hard block; require the
      target dialect to support `memoryBlocks` when blocks/`@` refs exist.
- [ ] Player boot (`store.playerBoot`, `src/player/`) accepts and installs
      blocks; the run path already flows through `loadProgram(image, opts)`.
- [ ] Tests: shareClient round-trip with blocks; compatibility matrix;
      `e2e/share-flow` stubs extended with a blocks payload; player e2e
      running the border sample.

**Depends on:** Stages 1–7 (dialect coverage as shipped).

## Stage 11 — Assembler (Z80 first, then 6502) ⬜

The Asm tab becomes an editor: edit assembly → assemble → block bytes, with
inline errors like the BASIC linter.

- [ ] **Library survey (July 2026):**
      [asm80](https://github.com/asm80/asm80-node) (MIT) is the standout —
      one mature assembler covering **both Z80 and 6502** (plus 8080/6809/
      65816/1802), powering asm80.com for years; the standalone repo was
      archived Feb 2026, so **vendor it** (repo vendoring convention,
      `LICENSE-*.md`) rather than depend on an archived npm package.
      Alternatives: [@andrivet/z80-assembler](https://github.com/andrivet/z80-assembler)
      (TypeScript, PEG-derived, Z80-only) and the `z80-asm` package from the
      `lkesteloot/trs80` monorepo. Writing from scratch is the fallback, not
      the default. Whichever engine: wrap it behind a common interface that
      returns `{ bytes, errors }` shaped like `TokenizeError`
      (errors-not-throws), with `ORG` pinned to the block address (mismatch =
      error).
- [ ] New `src/asm/<cpu>/assemble.ts` wrappers + `src/asm/z80/language.ts` —
      a small StreamLanguage for highlighting (pattern:
      `src/editor/basicLanguage.ts`, but standalone).
- [ ] `MemoryBlock.asmSource?: string` — persisted in `.bproj` v1 and autosave
      (optional field, no version bump). **Bytes remain the source of truth**
      for run/export; the Asm editor shows "modified — assemble to apply";
      hex-editing a block with `asmSource` marks the asm stale; "Start from
      disassembly" seeds the editor.
- [ ] `AsmView.tsx` swaps its listing for a second CodeMirror instance (own
      component reusing the Compartment/lint patterns of `CodeMirrorHost`,
      not the component itself); the disassembly listing remains the fallback
      for blocks with no `asmSource`.
- [ ] Round-trip test: `assemble(disassemble(bytes))` byte-identical over the
      supported instruction set (this also pins the assembler's syntax to
      what the disassembler emits). 6502 follows the same interface; docs
      note BBC users can also keep using the ROM's own `[ ]` assembler.

**Depends on:** Stages 3, 6 (Z80); 8 (6502).

## Stage 12 — Docs ⬜

- [ ] `docs/reference/file-formats.md` — the `.bproj` bundle, multi-file
      `.TAP`, per-block `.prg`/`.atm`/`.cas`, the ZX81 sidecar caveat.
- [ ] Per-dialect reference pages — a "Machine code & data blocks" section as
      each dialect's stage lands (addresses, CLEAR behaviour, auto-loader).
- [ ] New `docs/guide/machine-code.md` — creating a block, hex editing,
      `@name` refs, per-machine USR/SYS/CALL recipes, exporting for real
      hardware. Docs conventions apply: no `src/` paths or internal symbols in
      guide/reference pages.

**Depends on:** each documented stage.

---

## Cross-cutting risks

- **Spectrum program-area collision math** can't see runtime variable growth;
  the slack margin plus the typed `CLEAR` mitigate but don't prove safety.
  Only overlap with the tokenized program itself is an _error_; the variables
  region is a warning.
- **128K paging / VIC-20 RAM expansions** — blocks address the boot-time
  memory map only; documented, not solved.
- **Mobile nibble editing ergonomics** are unproven — the hex keypad row ships
  in Stage 3 and will need iteration.
- **`mapColumn` off-by-ones** produce misplaced lint squiggles — heavy test
  coverage required.
- **Share 64 KB limit** bites quickly with base64 blocks — the dialog must
  fail clearly (Stage 10).
- **Licensing** is clean: the app is GPL-3.0-or-later; `z80-disasm` and
  `asm80` are MIT; jsbeeb (GPL) is importable; the viciious disassembler is
  public domain.
