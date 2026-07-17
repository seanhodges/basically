# Memory blocks — edit & export implementation plan

> A dependency-ordered, multi-stage plan to make machine code and data blocks
> first-class document content on the **authoring/write** side: created and
> edited in the IDE (hex editor, then assembly view, then a full assembler),
> referenced from BASIC via `@name`, and written back out through export so they
> load on real hardware. Each stage is a medium, single-session task for the
> coding agent and leaves the app shippable (typecheck/test/lint/format green,
> no half-wired UI). Run stages in order; ZX Spectrum ships first, other
> dialects follow by format affinity.
>
> This is one of two companion plans. The **load & run** plan
> (`memory-blocks-load-and-run-plan.md`) establishes the shared `MemoryBlock`
> data model, per-dialect metadata, the block linter, emulator injection, import,
> and share links. **This plan depends on those foundations** — build the load &
> run plan's Stages 1–2 (data model + dialect metadata & lint) first. Where the
> two tracks touch, this plan flags it as a **cross-plan** note.

## Problem

The IDE treats a document as a single string of BASIC source, so there is no way
to author the machine code and data that real programs use, and export goes
through `BuildTarget.build(source, { programName })` — BASIC only, blocks
dropped. The load & run plan lets blocks be persisted, imported, and run; this
plan lets a user **create** a block, **edit** its bytes (and later its assembly),
reference it from BASIC by name, and **export** it so it round-trips onto real
hardware.

## Design decisions (fixed)

- **Editing model:** the hex/ascii editor is the write path first; the assembly
  tab starts as read-only disassembly; a full edit-assemble assembler is a later
  stage of this same plan.
- **BASIC referencing: both** plain addresses with autocomplete and symbolic
  `@name` refs substituted in an app-level pre-pass (IDE-side syntax;
  detokenize/import emits plain numbers).
- **Tabs, not dialogs:** the hex editor and assembly view are fully responsive
  tabs in the editor area — the first real editor-pane tab system (today there
  is exactly one `CodeMirrorHost` and only the mobile pane switcher).
- **Export uses the authentic multi-block format** (Spectrum multi-file `.TAP`
  with an optional auto-loader, per-block `.prg`/`.atm`/`.cas`, sidecar `.bin`)
  so exports load on real hardware — the counterpart to the load & run plan's
  direct-write emulator injection.

## Key facts the plan builds on

- **Seam:** `Dialect` / `MachineEmulator` in `src/dialects/types.ts`. The
  `MemoryBlock` type, the per-dialect `MemoryBlocksSupport` capability, and
  `lintBlocks` are provided by the load & run plan (its Stages 1–2).
- **Spectrum:** `tapfile.ts` already has `tapFromPayloads` and block scanning;
  export composes a multi-file TAP from the BASIC program plus CODE files.
- **UI:** store uses a counter/seq command-bus; hex prior art in
  `src/storage/vfs/hexdump.ts` + `VfsInspectorDialog`; `charset.glyph(code)`
  gives per-byte glyphs (charsets are total over 0x00–0xFF).
- **CPU tooling in-tree:** two vendored 6502 disassemblers exist (viciious
  `tools/disasm.js`, public domain, unused; jsbeeb `Disassemble6502`). No Z80
  disassembler or any assembler exists in-tree; see the library survey under
  Stages 4 and 7. Vendored cores are "don't touch"; wrap in adapters only.
- **Tests convention:** colocated `*.test.ts`; `roundTripHarness.ts` /
  `roundTrip.test.ts` / per-dialect `foreignRoundTrip.test.ts`. Gate:
  `npm run typecheck && npm test && npm run lint && npm run format:check`.

## Status legend

✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked

| Stage | Title                                                | Status |
| ----- | ---------------------------------------------------- | ------ |
| 1     | Editor tabs & read-only hex viewer                   | ⬜     |
| 2     | Editable hex editor + raw `.bin` per-block load/save | ⬜     |
| 3     | Spectrum `.TAP` export of CODE blocks                | ⬜     |
| 4     | Assembly view (read-only) + Z80 disassembler         | ⬜     |
| 5     | BASIC integration: `@name` refs, completions, lint   | ⬜     |
| 6     | Rollout: editor, export & disassembly                | ⬜     |
| 7     | Assembler (Z80 first, then 6502)                     | ⬜     |
| 8     | Docs                                                 | ⬜     |

---

## Stage 1 — Editor tabs & read-only hex viewer ⬜

The first editor-area tab system, gated on the per-dialect `memoryBlocks`
capability, with block create/delete/metadata editing and a read-only hex/ascii
view. Non-Spectrum dialects see no change.

- [ ] `src/app/store.ts` — `editorTab: 'basic' | 'hex' | 'asm'`,
      `activeBlockId: string | null`; reset on document loads and dialect
      switch; `removeBlock` fixes up `activeBlockId`. (Reuses the
      `blocks`/`upsertBlock`/`removeBlock` actions from the load & run plan's
      Stage 1.)
- [ ] New `src/components/EditorTabs.tsx` — slim tab strip at the top of
      `.editorPane`, rendered only when `dialect.memoryBlocks` exists.
- [ ] New `src/components/MemoryTab.tsx` — block selector (list on desktop
      widths, dropdown on narrow), "New block…" form validated against
      `memoryBlocks`, metadata editing, delete-with-confirm, hex grid below.
      Surface `lintBlocks` issues as badges here + an error dot on the tab strip.
- [ ] New `src/components/HexGrid.tsx` — read-only this stage: address gutter,
      hex cells, ascii column via `dialect.charset.glyph(byte)`. Hand-rolled
      row windowing (blocks ≤ 48 KB; no dependency); bytes-per-row 16/8/4 from
      container width via ResizeObserver.
- [ ] `src/components/Workspace.tsx` — keep `CodeMirrorHost` **always
      mounted**, toggle `display:none` (preserves EditorView state, undo, the
      `docOverride` seq channel). Editor tabs live _inside_ the editor pane so
      they compose with the mobile pane switcher on phones.
- [ ] Tests: windowing math extracted to a pure helper + test. New
      `e2e/memory-blocks.spec.ts` (strip appears on Spectrum only; create a
      block; tab switch preserves editor content); confirm
      `e2e/landscape-layout.spec.ts` still passes.

**Design notes:** fixed tabs (BASIC | Memory | Asm-later) with a block selector
inside — not tab-per-block (unbounded strips on phones). Custom React grid, not
CodeMirror, for hex: a fixed-geometry, two-column, overwrite-mode surface fights
CodeMirror's text model. `formatHexDump` stays as-is for the VFS inspector.

**Depends on:** load & run plan Stages 1–2 (data model + dialect metadata &
lint).
**Verify:** full gate + e2e; phone-portrait viewport — tab strip fits, grid
drops to 8 columns.

## Stage 2 — Editable hex editor + raw `.bin` per-block load/save ⬜

- [ ] `HexGrid.tsx` — cell selection + caret; hex column nibble-wise
      **overwrite** editing (`0–9a–f`, high then low nibble, auto-advance);
      ascii column via `charset.toMachine` (unmappable → ignore + status
      flash); arrow/PageUp/Home navigation. Edits go through `upsertBlock`
      with a fresh `bytes` array (immutable updates keep Zustand semantics).
- [ ] `MemoryTab.tsx` — resize (grow pads with a fill byte, shrink confirms),
      "Fill selection…", "Load bytes from file…" (replaces block bytes),
      "Save block as `.bin`" (plain byte download; _addressed_ formats arrive
      in Stage 3).
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

**Depends on:** Stage 1.
**Verify:** full gate + e2e; tap targets ≥ 32 px on touch.

## Stage 3 — Spectrum `.TAP` export of CODE blocks ⬜

Export produces a multi-file `.TAP` loadable on real hardware; WAV export
carries the same blocks. The counterpart import that turns CODE files back into
blocks lives in the load & run plan (its Stage 4).

- [ ] `tapfile.ts` — `codeTapBlocks(name, address, bytes)` (header type 3,
      param1 = address, param2 = 0x8000 per convention); `buildMultiTap(files)`.
- [ ] `src/dialects/types.ts` —
      `BuildTarget.build(source, { programName; blocks? })`.
- [ ] `zxspectrum/targets.ts` — multi-file TAP. **Auto-loader checkbox,
      default ON when blocks exist:** TAP order is an auto-run loader BASIC
      (`CLEAR min-1 : LOAD "" CODE : … : LOAD ""`), CODE files in address
      order, then the main program auto-starting at its first line. Without the
      loader: main program (load-only) first, CODE files after, and a
      Transfer-dialog notice when the source contains no `LOAD "" CODE` of its
      own. The user's program is untouched in both modes. WAV target encodes the
      same block list.
- [ ] `TransferDialog.tsx` — pass store blocks into `build`; loader checkbox
      (Spectrum tap/wav only).
- [ ] Tests: tapfile additions (CODE header layout, param1 round-trip); a
      blocks-aware `importRoundTripWithBlocks` helper in `roundTripHarness.ts`;
      **build → import round-trip equality** (this exercises the load & run
      plan's import path, which this stage can assume already exists).

**Cross-plan:** relies on `parseTapAllFiles` / block import from the load & run
plan's Stage 4 for the round-trip test.

**Depends on:** Stages 1–2; load & run plan Stage 4 (import).
**Verify:** full gate. Manual: exported TAP runs in an external emulator
(e.g. Fuse) — auto-loader runs, border flips; re-import and drag-drop restore
source + block.

## Stage 4 — Assembly view (read-only) + Z80 disassembler ⬜

An "Asm" tab showing disassembly of the active `kind: 'code'` block, behind a
per-CPU `Disassembler` interface in a new `src/asm/` module.

- [ ] New `src/asm/types.ts` —
      `DisassembledLine { address, bytes, text }`;
      `type Disassembler = (bytes: Uint8Array, origin: number) => DisassembledLine[]`.
- [ ] New `src/asm/registry.ts` — `disassemblerFor(cpu)` (`'6502'` returns null
      until the rollout stage).
- [ ] New `src/asm/z80/` — the Z80 disassembler. **Library survey (July
      2026):** [z80-disasm](https://github.com/lkesteloot/z80-disasm) is a solid
      MIT TypeScript disassembler (JSON opcode tables; standalone repo archived,
      continued inside the author's `trs80` monorepo);
      [z80js](https://github.com/viert/z80js) bundles one with a debugger.
      **Approach: adapt/vendor `z80-disasm` (MIT) following the repo's vendoring
      convention (`LICENSE-*.md` alongside, like `z80core` / `viciious`),
      wrapped behind `Disassembler`.** Fall back to writing a table-driven one
      from scratch only if adaptation proves awkward — either way the gotchas to
      test: CB/ED/DD/FD prefixes, DDCB/FDCB (displacement byte _before_ the final
      opcode), JR/DJNZ shown with absolute targets, ED holes as `DB`, truncated
      tail handling.
- [ ] New `src/components/AsmView.tsx` — read-only windowed listing
      (address | bytes | mnemonic); selector restricted to `kind: 'code'`
      blocks; "edit bytes in the Memory tab" hint. Asm tab visible when the
      dialect is supported, a disassembler exists for its CPU, and at least one
      code block exists.
- [ ] Tests: golden encodings across every prefix family (`ED B0 → LDIR`,
      `DD CB 03 46 → BIT 0,(IX+3)`, `18 FE → JR $` target math, truncated
      instruction at end).

**Depends on:** Stage 1.
**Verify:** full gate; the border-flip block disassembles to
`LD A,2 / OUT (0FEh),A / RET`; e2e: create a code block → Asm tab appears.

## Stage 5 — BASIC integration: `@name` refs, completions, lint ⬜

BASIC source may write `RANDOMIZE USR @border`; the IDE substitutes the address
everywhere bytes are produced; completions and lint understand blocks.
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
      lint (`lintIntegration.ts` reads blocks imperatively inside the debounced
      callback — no extension rebuild on block edits — and remaps diagnostic
      columns via `mapColumn`), byte counter (`useProgramStats`).
- [ ] `CodeMirrorHost.tsx` — extra completion source (own Compartment): block
      names after `@`, and `@name`/address completions after `USR` (dialect
      keyword list; generalizes to `SYS`/`CALL` in the rollout stage). Info
      popup shows address + size + comment.
- [ ] `src/share/compatibility.ts` + `ShareLinkDialog.tsx` — documents with `@`
      refs flagged not-shareable with a clear notice **until the load & run
      plan's share stage lands**; once both are in, the shared blocks travel and
      the receiver resolves `@name` at its own tokenize time.
- [ ] Tests: substitution, strings/REM immunity, unknown-name error position,
      `mapColumn` across multiple refs per line, unmatched-address warnings;
      lint integration test that the squiggle lands on the `@name` token; run
      path test that `10 RANDOMIZE USR @border` tokenizes cleanly.

**Design note:** substitution at the app layer, not inside each dialect's
tokenizer — all tokenizers stay untouched, one tested implementation, composes
with the errors-not-throws convention.

**Depends on:** Stages 1–2 (Stage 3 or the load & run plan's emulator loading
for a satisfying demo).
**Verify:** full gate; typing `@` completes block names; renaming a block lints
the stale ref; the border sample written with `@border` runs.

## Stage 6 — Rollout: editor, export & disassembly ⬜

One shippable sub-stage per dialect, adding the authoring/write half — the block
editor is already generic, so this stage supplies each dialect's export format,
its `@`-ref keyword, and (for 6502 dialects) the disassembler wiring. The
metadata, injection, and import halves land in the load & run plan's rollout.

- [ ] **C64 / VIC-20 / PET** — new `src/asm/mos6502/` — wrap the vendored,
      public-domain, currently unused
      `src/emulator/c64/viciious/tools/disasm.js` (`disasm(cpuRead, addr, to)`)
      behind `Disassembler` via a closure over the block bytes; register for
      `'6502'`. (Preferred over jsbeeb's `Disassemble6502` here because it is
      already vendored and dependency-free.) Export: **one `.prg` per block**
      (2-byte load address + bytes, `name.prg`) alongside the BASIC `.prg` —
      authentic (`LOAD "name",8,1`), no zip dependency. `@`-ref keyword: `SYS`.
      Tests: 6502 disassembler goldens (`A9 02 → LDA #$02`,
      `8D 20 D0 → STA $D020`, `60 → RTS`); blocks-aware export round-trip.
- [ ] **BBC Micro/Master** — disassembler = the 6502 wrapper (or jsbeeb's
      `Disassemble6502`, GPL-compatible, imported not forked); export raw memory
      files + `*RUN` guidance. Docs note that BBC BASIC's genuine inline `[ ]`
      assembler already works in the emulator — blocks complement it for
      pre-built binaries. Keywords: `CALL` / `USR`.
- [ ] **ZX81/ZX80** — the standard `.P`/`.O` snapshot **cannot carry
      above-RAMTOP data** (it spans `0x4009` → E_LINE only). Export blocks as
      sidecar `name-<addr>.bin` files with a Transfer-dialog notice; no
      nonstandard `.P` variant (compatibility with real tooling wins). The
      classic REM-line convention (code inside line 1 at 16514) needs no block
      and stays the documented fully-portable route — add a guide recipe.
      Disassembler: the Z80 one from Stage 4. Keywords: `USR`.
- [ ] **Atom** — export one `.atm` per block with real load/exec addresses.
      Keywords: `CALL` / `USR`.
- [ ] **TRS-80** — export blocks as SYSTEM-format `.cas` (name/address records);
      Z80 disassembler reused from Stage 4. Keywords: `USR` / `DEFUSR`.

**Depends on:** Stages 1–5; the corresponding dialect sub-stage in the load & run
plan's rollout.
**Verify:** per dialect — export format round-trip, disassembler goldens where
applicable, one manual export-and-reload recipe each.

## Stage 7 — Assembler (Z80 first, then 6502) ⬜

The Asm tab becomes an editor: edit assembly → assemble → block bytes, with
inline errors like the BASIC linter.

- [ ] **Library survey (July 2026):**
      [asm80](https://github.com/asm80/asm80-node) (MIT) is the standout — one
      mature assembler covering **both Z80 and 6502** (plus 8080/6809/65816/
      1802), powering asm80.com for years; the standalone repo was archived
      Feb 2026, so **vendor it** (repo vendoring convention, `LICENSE-*.md`)
      rather than depend on an archived npm package. Alternatives:
      [@andrivet/z80-assembler](https://github.com/andrivet/z80-assembler)
      (TypeScript, PEG-derived, Z80-only) and the `z80-asm` package from the
      `lkesteloot/trs80` monorepo. Writing from scratch is the fallback, not the
      default. Whichever engine: wrap it behind a common interface that returns
      `{ bytes, errors }` shaped like `TokenizeError` (errors-not-throws), with
      `ORG` pinned to the block address (mismatch = error).
- [ ] New `src/asm/<cpu>/assemble.ts` wrappers + `src/asm/z80/language.ts` — a
      small StreamLanguage for highlighting (pattern:
      `src/editor/basicLanguage.ts`, but standalone).
- [ ] `MemoryBlock.asmSource?: string` — persisted in `.bproj` v1 and autosave
      (optional field, no version bump — the load & run plan's `projectFile.ts`
      reserves room for it). **Bytes remain the source of truth** for
      run/export; the Asm editor shows "modified — assemble to apply";
      hex-editing a block with `asmSource` marks the asm stale; "Start from
      disassembly" seeds the editor.
- [ ] `AsmView.tsx` swaps its listing for a second CodeMirror instance (own
      component reusing the Compartment/lint patterns of `CodeMirrorHost`, not
      the component itself); the disassembly listing remains the fallback for
      blocks with no `asmSource`.
- [ ] Round-trip test: `assemble(disassemble(bytes))` byte-identical over the
      supported instruction set (this also pins the assembler's syntax to what
      the disassembler emits). 6502 follows the same interface; docs note BBC
      users can also keep using the ROM's own `[ ]` assembler.

**Depends on:** Stages 2, 4 (Z80); Stage 6 (6502).
**Verify:** full gate; edit the border block's assembly, assemble, run → red
border; hex-editing it afterwards flags the asm as stale.

## Stage 8 — Docs ⬜

- [ ] `docs/reference/file-formats.md` — the export side: multi-file `.TAP`,
      per-block `.prg`/`.atm`/`.cas`, the ZX81 sidecar caveat.
- [ ] Per-dialect reference pages — a "Machine code & data blocks" section as
      each dialect's authoring sub-stage lands (auto-loader, export formats,
      USR/SYS/CALL keyword).
- [ ] New/shared `docs/guide/machine-code.md` — the authoring half: creating a
      block, hex editing, assembly view/assembler, `@name` refs, per-machine
      USR/SYS/CALL recipes, exporting for real hardware. Docs conventions apply:
      no `src/` paths or internal symbols in guide/reference pages. **Cross-plan:**
      the run-and-share half of this guide is filled in by the load & run plan.

**Depends on:** each documented stage.

---

## Cross-cutting risks

- **Mobile nibble editing ergonomics** are unproven — the hex keypad row ships
  in Stage 2 and will need iteration.
- **`mapColumn` off-by-ones** produce misplaced lint squiggles — heavy test
  coverage required (Stage 5).
- **Spectrum auto-loader correctness** — the generated loader BASIC must `CLEAR`
  below the lowest block and load CODE files in the right order; verify against
  a real emulator, not just re-import.
- **Assembler/disassembler syntax drift** — the round-trip test pins the
  assembler to what the disassembler emits; widen it as the instruction set
  grows (Stage 7).
- **Licensing** is clean: the app is GPL-3.0-or-later; `z80-disasm` and `asm80`
  are MIT; jsbeeb (GPL) is importable; the viciious disassembler is public
  domain.
