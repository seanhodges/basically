# Memory blocks — load & run implementation plan

> A dependency-ordered, multi-stage plan to make machine code and data blocks
> first-class document content on the **read/run** side: persisted with the
> document, loaded from imported files, and written into the emulator on Run —
> then shared through short links. Each stage is a medium, single-session task
> for the coding agent and leaves the app shippable (typecheck/test/lint/format
> green, no half-wired UI). Run stages in order; ZX Spectrum ships first, other
> dialects follow by format affinity.
>
> This is one of two companion plans. The **edit & export** plan
> (`memory-blocks-edit-export-and-plan.md`) covers authoring blocks in the IDE
> (hex/assembly editors, `@name` refs) and writing them out on export. It builds
> on the data model and dialect metadata established here. Where the two tracks
> touch, this plan flags it as a **cross-plan** note.

## Problem

The IDE treats a document as a single string of BASIC source. Everything
downstream assumes BASIC-only: autosave persists `{fileName, source}`; Run does
`dialect.tokenize(source)` → `machine.loadProgram(result.image)`
(`src/components/EmulatorPane.tsx`); and importers parse out only the BASIC
program — the Spectrum `.TAP` importer even detects CODE blocks and then
discards them with a warning (`parseTapWithReport`). Machine code and data that
real programs load alongside BASIC are invisible to the IDE, so they can neither
be persisted, imported, nor run.

This plan makes blocks survive persistence, arrive from imports, and reach the
emulator on Run. Creating and editing blocks in the IDE, and writing them back
out on export, is the companion plan's job.

## Design decisions (fixed)

- **First dialect: ZX Spectrum** (`src/dialects/zxspectrum/`, shared by
  `zxspectrum128`). `.TAP` is natively multi-block; CODE files with load
  addresses are the authentic mechanism, so import round-trips with zero format
  invention.
- **Emulator injection is a direct memory write**, not a synthesized tape: after
  the BASIC load completes and before RUN, each block is written straight into
  RAM (deterministic, instant). The authentic multi-block tape/disk file is the
  companion plan's _export_ story.
- **Blocks come from import or the data model** in this plan — there is no block
  editor yet, so tests and manual smokes seed blocks via a hand-built import
  file or the dev console. The editor UI lands in the companion plan.

## Key facts the plan builds on

- **Seam:** `Dialect` / `MachineEmulator` in `src/dialects/types.ts`.
  `loadProgram(image)` is the only injection API; no public memory read/write,
  but every core has an internal primitive (Spectrum `memory.write`, jsbeeb
  `cpu.writemem`, viciious `wires.cpuWrite`, 6502 `BusInterface.poke`,
  `Zx81Memory.write`, `Trs80Memory.write`). Optional emulator methods are
  feature-detected (`typeof m.x === 'function'`).
- **Spectrum:** `tapfile.ts` already has block scanning and
  `parseTapWithReport`; `spectrumMachine.loadProgram` injects via the ROM tape
  trap then types `RUN` — a window exists between LOAD completing and RUN for
  direct block writes.
- **Store:** single Zustand store with a counter/seq command-bus; document loads
  flow through `loadUnsavedDocument` / `replaceDocument` / `playerBoot`.
- **Tests convention:** colocated `*.test.ts`; `roundTripHarness.ts` /
  `roundTrip.test.ts` / per-dialect `foreignRoundTrip.test.ts`. Gate:
  `npm run typecheck && npm test && npm run lint && npm run format:check`.

## Status legend

✅ shipped · 🔨 in progress · ⬜ planned · ⛔ blocked

| Stage | Title                                             | Status |
| ----- | ------------------------------------------------- | ------ |
| 1     | Data model & persistence                          | ⬜     |
| 2     | Dialect metadata & block lint                     | ⬜     |
| 3     | Emulator loading (Spectrum)                       | ⬜     |
| 4     | Spectrum `.TAP` import of CODE blocks             | ⬜     |
| 5     | Rollout: loading, injection & import              | ⬜     |
| 6     | Share links & player                              | ⬜     |
| 7     | Docs                                              | ⬜     |

---

## Stage 1 — Data model & persistence ⬜

A `MemoryBlock` document model that survives reload (autosave) and Save/Open (a
concrete on-disk project format), with correct dirty/New/Open/Save semantics.
Invisible in the UI; nothing changes for pure-BASIC documents. **This is the
shared foundation for both plans.**

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
      import-style path) / `isProjectFile` (cheap sniff). **Cross-plan:** the
      edit-export plan's assembler adds an optional `asmSource` field to each
      serialized block — an additive field, no version bump.
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

## Stage 2 — Dialect metadata & block lint ⬜

The per-dialect capability that declares where blocks may live, plus the
collision/validation linter the Run path gates on. No UI yet — non-Spectrum
dialects and pure-BASIC documents are unaffected. **Shared foundation:** the
edit-export plan's block editor reuses this capability and linter.

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
- [ ] New `src/app/blockLint.ts` —
      `lintBlocks(blocks, support, programByteSize): BlockIssue[]`. Errors:
      outside `validRanges`, block–block overlap, program-area overlap,
      duplicate/invalid names. Warnings: reserved-range overlap.
- [ ] Tests: `blockLint.test.ts` (all collision classes, boundary off-by-ones),
      `memoryBlocks.test.ts`.

**Design note:** the capability is metadata only; nothing renders it yet. The
edit-export plan surfaces the linter's issues as badges in the Memory tab and an
error dot on the tab strip.

**Depends on:** Stage 1.
**Verify:** full gate; `lintBlocks` unit tests cover every collision class.

## Stage 3 — Emulator loading (Spectrum) ⬜

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
the authentic multi-block TAP is the _export_ story (edit-export plan). No
public `writeMemory` on the seam yet — `loadProgram` is its only consumer; a
feature-detected read/write pair can come later if a live-memory view is wanted.

**Depends on:** Stages 1–2.
**Verify:** full gate. Manual smoke (recurring): block `border` at 32768 =
`3E 02 D3 FE C9` (`LD A,2 / OUT (0xFE),A / RET`), BASIC
`10 RANDOMIZE USR 32768` → red border. Works on `zxspectrum128` too. Seed the
block via the dev console or a hand-built import until the editor lands.

**Risks:** 128K paging — blocks address the boot-time 48K-compatible map;
document, don't solve. Verify `CLEAR` keystroke timing on both ROMs.

## Stage 4 — Spectrum `.TAP` import of CODE blocks ⬜

Import turns CODE files into memory blocks instead of discarding them, so a
real-hardware `.TAP` round-trips its machine code into the IDE.

- [ ] `tapfile.ts` — `parseTapAllFiles(image)` →
      `{ program, code[], warnings }` (arrays still skipped with a warning;
      headerless data blocks warned). CODE files carry header type 3 with
      param1 = load address.
- [ ] `src/dialects/types.ts` — `DetokenizeResult` gains
      `blocks?: MemoryBlock[]`.
- [ ] Import — detokenizer/report uses `parseTapAllFiles`: CODE files become
      blocks (name from `headerName`, `kind: 'code'` default); a loader-shaped
      first program followed by a payload program imports the payload and warns
      about the skipped loader. `src/app/importProgram.ts` plumbs `blocks`
      through to `loadUnsavedDocument`.
- [ ] Tests: `parseTapAllFiles` (CODE header layout, multi-file scan, param1
      round-trip) built against **hand-constructed** TAP bytes so the import
      path is self-contained (the export side that emits these files lives in
      the edit-export plan).

**Cross-plan:** the full build → import round-trip equality test lives with the
export stage (edit-export plan), which can depend on this import path already
existing.

**Depends on:** Stages 1–3.
**Verify:** full gate. Manual: drag-drop a `.TAP` containing a CODE file →
source + block appear; Run writes the block and the program that references it
behaves.

## Stage 5 — Rollout: loading, injection & import ⬜

One shippable sub-stage per dialect, adding the read/run half — metadata, the
lint figures, emulator injection, and per-format import — in this order. The
editor and export halves for each dialect land in the companion plan.

- [ ] **C64 / VIC-20 / PET** — `memoryBlocks.ts` per dialect (`cpu: '6502'`).
      C64: valid `0x0800–0xFFFF`, reserved zero page/stack/screen and the
      IO-banked `0xD000` area (warn), `programArea` from `0x0801`, default
      `0xC000`. VIC-20/PET: conservative base-RAM figures (expansions
      documented, not modeled). Injection in the adapters only: viciious
      `wires.cpuWrite`, PET/VIC-20 `BusInterface.poke`, after BASIC injection,
      before the auto-RUN. Import: a `.prg` whose load address is not the BASIC
      start (or one dropped while a program is open) imports as a block;
      multi-`.prg` drop supported.
- [ ] **BBC Micro/Master** — PAGE-based `programArea`; blocks in mode-dependent
      `0x0E00–0x7FFF` with a display-mode warning; inject via jsbeeb
      `cpu.writemem`; import raw memory files.
- [ ] **ZX81/ZX80** — emulator injection anywhere in RAM via `Zx81Memory.write`.
      Import blocks from sidecar `name-<addr>.bin` files. Note that the standard
      `.P`/`.O` snapshot **cannot carry above-RAMTOP data** (it spans `0x4009` →
      E_LINE only) — the export-side caveat lives in the companion plan; here the
      concern is only reading sidecar bytes back in.
- [ ] **Atom** — relax `stripAtmHeader`'s throw so a non-`#2900` `.atm` imports
      as a block instead of erroring (real load/exec addresses preserved).
      Inject via `cpu.writemem`.
- [ ] **TRS-80** — inject via `Trs80Memory`; import SYSTEM-format `.cas`
      (name/address records) as blocks.

**Depends on:** Stages 1–4.
**Verify:** per dialect — metadata tests, injection PEEK test, format import
test, one manual border/screen-poke recipe each (e.g. C64 block
`A9 02 8D 20 D0 60` at 49152, `10 SYS 49152` → border red).

## Stage 6 — Share links & player ⬜

- [ ] `src/share/shareClient.ts` — wire contract v2: optional
      `blocks: SerializedBlock[]` (reuse the `projectFile.ts` serialization);
      the 64 KB limit now includes base64 blocks — fail with a clear over-limit
      message.
- [ ] `src/share/compatibility.ts` — require the target dialect to support
      `memoryBlocks` when blocks exist. **Cross-plan:** the edit-export plan's
      `@name` stage adds a temporary "not shareable with `@` refs" flag until
      this stage lands; once both are in, a shared document carries its blocks
      and the receiver resolves any `@name` at its own tokenize time.
- [ ] Player boot (`store.playerBoot`, `src/player/`) accepts and installs
      blocks; the run path already flows through `loadProgram(image, opts)`.
- [ ] Tests: shareClient round-trip with blocks; compatibility matrix;
      `e2e/share-flow` stubs extended with a blocks payload; player e2e running
      the border sample.

**Depends on:** Stages 1–5 (dialect coverage as shipped).
**Verify:** full gate + e2e; share a document with a block, open the link in the
player → the block runs.

## Stage 7 — Docs ⬜

- [ ] `docs/reference/file-formats.md` — the `.bproj` bundle and the imported
      formats that become blocks (multi-file `.TAP`, per-block `.prg`/`.atm`/
      `.cas`, the ZX81 sidecar caveat) on the read side.
- [ ] Per-dialect reference pages — a "Machine code & data blocks" section as
      each dialect's loading sub-stage lands (addresses, CLEAR behaviour,
      import formats).
- [ ] New/shared `docs/guide/machine-code.md` — the run-and-share half:
      importing a program with machine code, running it, sharing the link. Docs
      conventions apply: no `src/` paths or internal symbols in guide/reference
      pages. **Cross-plan:** the authoring half of this guide (creating and
      editing blocks) is filled in by the edit-export plan.

**Depends on:** each documented stage.

---

## Cross-cutting risks

- **Spectrum program-area collision math** can't see runtime variable growth;
  the slack margin plus the typed `CLEAR` mitigate but don't prove safety.
  Only overlap with the tokenized program itself is an _error_; the variables
  region is a warning.
- **128K paging / VIC-20 RAM expansions** — blocks address the boot-time
  memory map only; documented, not solved.
- **Share 64 KB limit** bites quickly with base64 blocks — the dialog must fail
  clearly (Stage 6).
- **No editor yet** — until the companion plan ships, blocks in this track come
  only from imports or the dev console; keep the manual smokes runnable that
  way.
