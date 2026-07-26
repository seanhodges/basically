## Context

The CPC 464 was built as half of a pair, with the 6128's seams cut in advance
(see `docs/contributing/dialect-plans/cpc464.md`, all six stages shipped):

- `src/dialects/cpc464/keywords.ts` carries a `LocoBasicVariant =
  'basic10' | 'basic11'` flag; the eleven 1.1-only entries are already tagged
  `since: 'basic11'`, `locoKeywords(v)` / `locoVariant(v)` already derive a
  per-variant editor table and tokenizer table, and `basic10` already rejects
  the 1.1 words.
- `tokenizeProgram` / `detokenizeProgram` / `detokenizeWithReport` already take
  a `variant` parameter defaulting to `'basic10'`.
- `src/emulator/cpc/memory.ts` already takes `CpcModel = '464' | '6128'` and
  exposes an inert `setRamConfig()`; `cpcMachine.ts` **already forwards**
  `&7Fxx` writes whose top two bits are `11` to it.
- `src/dialects/cpc464/sysvars.ts` is keyed by variant, with the `'basic11'`
  branch a throwing stub, and `vars.ts` / `reports.ts` read through it.
- `docs/reference/data/cpc.ts` already labels 1.1-only keywords
  `tag: 'BASIC 1.1 only'`.

`src/dialects/cpc6128/` exists as five type-valid throwing stubs, deliberately
absent from the registry. The architecture this design works within is described
in `docs/contributing/architecture.md`; the staged engineering record is
`docs/contributing/dialect-plans/cpc6128.md`, which this change follows
(Stages A–D) and updates as it lands.

## Goals / Non-Goals

**Goals:**

- A registered, feature-complete CPC 6128 at parity with the 464 on every
  `Dialect` / `MachineEmulator` capability the 464 implements.
- Locomotive BASIC 1.1 as the language, with BASIC 1.0 source producing
  byte-identical program bytes on both machines.
- 128K RAM modelled faithfully enough that a program that banks deliberately
  observes real behaviour.
- Zero behavioural change to the CPC 464.

**Non-Goals:** as stated in `proposal.md` — AMSDOS, the µPD765 FDC, `.dsk`,
CP/M, the CPC 664, and any change to the `Dialect` / `MachineEmulator` seam.

## Dialect seam impact

**None.** The 6128 is a new implementation of the existing `Dialect` interface
and a new `CpcModel` branch inside an existing machine. No interface member is
added, removed or re-typed, and no consumer of the seam changes. The only
edits outside `src/dialects/cpc6128/` and `src/emulator/cpc/` are the
per-dialect lookup tables every new machine must extend (registry, share verbs,
editor constructs, keyboard theme CSS, machine portraits) and the shared
`sysvars.ts` variant branch that was left throwing for this change.

## Decisions

### Delegate to `cpc464` rather than fork it

The 6128 imports the 464's charset, tokenizer, detokenizer, samples, keyboard
rows, build targets and cassette audio, owning only what genuinely differs: the
1.1 keyword selection, the emulator model, its memory map, its sysvar table, its
AI profile, its keyboard theme and its metadata. This is the `bbcmaster` /
`zxspectrum128` pattern, and the 464 was written to support it.

*Alternative considered:* a standalone dialect folder with its own copies. It
would let the two diverge freely, but duplicates the most intricate tokenizer in
the repo (Locomotive BASIC stores numeric constants in binary) and guarantees
the two drift. Rejected.

### One combined 32K ROM image, not two 16K halves

`docs/contributing/dialect-plans/cpc6128.md` specified `cpc6128_os.rom` +
`cpc6128_basic.rom`. The 464 ultimately shipped a single combined
`public/roms/cpc/cpc464.rom` (16K OS followed by 16K BASIC), which is what
`CpcMemory`'s constructor expects (`CPC_ROM_SIZE = 0x8000`) and what the
single-`romUrl` fetch path in `EmulatorPane` supports. The 6128 follows the
shipped convention: **`public/roms/cpc/cpc6128.rom`**, 32K.

Provenance: the committed `cpc464.rom` is byte-identical (sha256 `00960d9b…`)
to the image the long-running CPC emulators ship, so the 6128 image is taken
from the same upstream and carries the same "1985 Amstrad Consumer Electronics
plc / Locomotive Software Ltd." notice, unmodified. `ATTRIBUTION.md`'s existing
Amstrad-permission and Locomotive-copyright reasoning is extended to cover it
rather than a new basis being invented. The plan file is amended to record the
deviation.

### RAM banking lives in `CpcMemory`, behind a fast path for config 0

The Gate Array's `%11xxxxxx` command group already reaches
`CpcMemory.setRamConfig()`. It gains a second 64K array and the eight standard
PAL configurations, mapping 16K banks over the four CPU windows:

| Config | &0000 | &4000 | &8000 | &C000 |
| ------ | ----- | ----- | ----- | ----- |
| 0      | 0     | 1     | 2     | 3     |
| 1      | 0     | 1     | 2     | 7     |
| 2      | 4     | 5     | 6     | 7     |
| 3      | 0     | 3     | 2     | 7     |
| 4–7    | 0     | 4–7   | 2     | 3     |

Banks 0–3 are the base 64K, 4–7 the expansion. Config 0 — the boot state and the
only configuration a BASIC program sees unless it asks otherwise — takes an
early-out to the existing direct `this.ram[a]` path, so the 464 and ordinary
6128 execution are untouched by the new indirection. On `'464'` the setter stays
a no-op and no expansion array is allocated.

**Video and introspection keep reading the base 64K.** On the real 6128 the
CRTC/Gate Array display circuitry always fetches from the first 64K regardless
of the CPU's RAM configuration, so `readScreen` / `readWord` (used by the
renderer, the variable watcher and the memory map) correctly stay on `ram`.

### The memory map stays a 64K address space

`memoryMap()` reports `addressSpace: 0x10000` with the banked second 64K
described in region notes, following the Spectrum 128. The map describes what a
CPU address means; presenting 128K linearly would misrepresent a machine where
the extra RAM is a windowed overlay, and the map overlay's activity buffer is
CPU-address-indexed.

### `programRamBytes` is measured, not quoted

A real disc-equipped 6128 reports 42249 free after AMSDOS claims its workspace.
This build ships without AMSDOS, so the figure is taken from what the emulator's
own `PRINT FRE(0)` reports at boot (expected 42619) — the byte counter must
match the machine the user is actually running. Revisited when AMSDOS lands.

### BASIC 1.1 sysvar addresses are derived from the running ROM

The 1.0 table was pinned by injecting programs into the emulator and observing
which workspace words moved, cross-checked against SOFT968. The 1.1 table is
established the same way against the 6128 ROM — never recalled from memory. Any
pointer that cannot be pinned confidently is left out and its reader left
inert rather than guessed.

### `fill` as the share verb

`FILL` is BASIC 1.1-only, so the verb names what distinguishes the machine —
mirroring `play` for the Spectrum 128. `SHARE_VERBS` in `src/player/routes.ts`
is a strict test-enforced bijection with the registry, so the verb and the
registration land in the same commit.

## Risks / Trade-offs

- **The BASIC 1.1 workspace addresses are the only genuine unknown** → derive
  them empirically in the emulator and assert them in colocated tests; ship any
  reader whose pointer resists identification as inert rather than wrong.
- **The 6128 firmware scans for expansion ROMs at boot** and this build models
  no `&DFxx` upper-ROM select, so ROM 7 (AMSDOS) is absent → this is the
  documented no-expansion configuration and is exactly why disc support is
  deferred; verified by the boot-banner and `FRE(0)` tests rather than assumed.
- **Banking adds a branch to the memory hot path** → config 0 early-outs to the
  existing direct path, so the common case (and the whole 464) is unchanged;
  guarded by the existing CPC emulator test suite.
- **`blurb` mentions the disc drive while disc support is deferred** → the blurb
  describes the machine, not the emulation; the deferral is stated in the docs
  and in `loadInstructions`/`saveInstructions`, which tell the user tape I/O
  needs `|TAPE` first.
- **Shipping a third-party firmware ROM** → same source, same unmodified
  copyright notice and same stated licensing basis as the already-shipped 464
  image; attribution extended, and a user-supplied ROM remains possible.

## Migration Plan

None required — this is additive. The dialect is absent from the registry until
the wire-up stage, so every intermediate state compiles and ships a working IDE.
Rollback is removing the registry entry, the matching `SHARE_VERBS` row and the
ROM.

## Open Questions

- Whether the 6128's HIMEM and default memory-block address match the 464's, or
  whether `memoryBlocks` needs its own figures. Resolved by reading the booted
  machine during Stage D rather than by assumption.
