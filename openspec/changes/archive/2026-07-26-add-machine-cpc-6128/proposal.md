## Why

The Amstrad CPC 464 shipped complete, but it shipped as half of a pair. Its
BASIC is Locomotive BASIC **1.0** — the version Amstrad replaced a year later,
and the one most surviving CPC listings were *not* written for. Type `FILL`,
`MASK`, `CURSOR`, `COPYCHR$` or `GRAPHICS PEN` — all ordinary Locomotive BASIC
to anyone who owned a CPC after 1985 — and the IDE rejects them, because the
only CPC it offers is the machine that predates them.

The 6128 is also the CPC people actually kept: 128K, BASIC 1.1, the model the
later software was written on. Everything needed to run it is already in the
tree, built deliberately during the 464 work — the keyword table already tags
its 1.1 entries, the memory class already takes a model, the introspection
readers are already keyed by BASIC variant, and the reference docs already carry
"BASIC 1.1 only" labels for keywords no registered machine can currently
tokenize. The seams are cut; nothing is plugged into them.

## What Changes

- **New target machine: CPC 6128.** Selectable in the machine picker alongside
  the 464, with its own portrait, grey-cap keyboard theme and share verb.
- **Locomotive BASIC 1.1.** Eleven keywords the 464 rejects — `CLEAR INPUT`,
  `COPYCHR$`, `CURSOR`, `DEC$`, `DERR`, `FILL`, `FRAME`, `GRAPHICS PAPER`,
  `GRAPHICS PEN`, `MASK`, `ON BREAK CONT` — tokenize, run, detokenize and
  autocomplete on the 6128. Programs using only BASIC 1.0 produce byte-identical
  output on both machines.
- **128K of RAM.** The second 64K bank set switches through the Gate Array/PAL
  RAM-configuration port. BASIC itself never leaves the base 64K, so this is
  visible to programs that bank deliberately, not to ordinary listings.
- **Full parity with the 464 everywhere else** — samples, cassette WAV and
  `.cdt`/`.bas` export, the virtual keyboard, joystick support, the memory map,
  the live variable watcher, the debugger and the AI assistant all work against
  the 6128 as they do the 464, driven from its own BASIC 1.1 workspace
  addresses.
- **Firmware ROM.** The 32K CPC 6128 image (OS 2.x + Locomotive BASIC 1.1) is
  bundled, from the same source and on the same licensing basis as the existing
  464 image, with `public/roms/ATTRIBUTION.md` extended to cover it.
- **Reference docs** gain the 6128 on the shared Amstrad CPC page; the roadmap
  row moves to shipped.

## Non-goals

- **AMSDOS, the µPD765 floppy controller and `.dsk` images.** The 6128 boots and
  runs BASIC without the AMSDOS ROM; shipping AMSDOS without an FDC would hang
  every disc command. This lands tape-only, like the 464, and disc support is a
  separate follow-up. `programRamBytes` is therefore taken from what the shipped
  configuration reports at boot, not from a real disc-equipped machine.
- **CP/M**, and any use of the extra 64K by the IDE itself.
- **The CPC 664.** A third Locomotive variant is not introduced.
- **Any change to CPC 464 behaviour.** The 464 keeps rejecting 1.1 keywords, and
  its tokenizer output, memory map and sysvar addresses are unchanged.
- **No change to the `Dialect` / `MachineEmulator` seam**, and no new dependency.

## Capabilities

### New Capabilities

None. Adding a machine introduces no new product capability — every capability
this change touches already exists and is already specified as applying to
whichever dialect is registered.

### Modified Capabilities

- `dialect-toolchain`: **added** requirement that BASIC dialect variants are
  honoured per machine. The 464/6128 pair is the first time the product
  guarantees that a keyword belonging to a later version of a shared BASIC is
  accepted on the machines that have it and reported as an error on those that
  do not, while source using only the shared version stays portable across the
  family — and that the reference docs mark which keywords are version-only.

Adding the machine itself needs no other delta: `dialect-toolchain` already
guarantees that "the IDE SHALL offer exactly the set of registered dialects as
target machines, and every capability in this product (editing, running,
exporting, AI assistance) SHALL work against whichever dialect is active" — a
new registered dialect satisfies that requirement rather than changing it. The
same holds for `program-execution`, `hardware-transfer`, `virtual-input`,
`memory-blocks`, `sharing-player` and `ai-assistant`, all written per-dialect.

## Impact

- **New dialect:** `src/dialects/cpc6128/` — currently unregistered throwing
  scaffolding, filled in and registered.
- **Shared CPC machine:** `src/emulator/cpc/` gains the `'6128'` model — RAM
  banking behind the existing `setRamConfig` seam and the BASIC 1.1 ROM pair.
  The `'464'` path is unchanged.
- **Per-dialect tables outside the dialect folder:** the registry, the share-verb
  table (a strict bijection with the registry), editor constructs, the keyboard
  theme stylesheet, and the machine portrait list.
- **Assets:** one new 32K ROM under `public/roms/cpc/`, plus its attribution.
- **Docs:** the shared Amstrad CPC reference page, the dialect roadmap, and the
  staged engineering plan at `docs/contributing/dialect-plans/cpc6128.md`, which
  remains the detailed record for this work.
- **No API, dependency or seam changes.**
