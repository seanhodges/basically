## Why

`public/roms/ATTRIBUTION.md` is the project's answer to the rights holders whose
firmware it ships. It tells them, six times over, that "the IDE also supports
supplying your own ROM image at runtime" — and, of the Amstrad images, that "the
bundled copies can be removed without disabling the feature". That sentence is
what makes the removal request a rights holder is invited to make ("if you are
the rights holder and want these files removed, please open an issue") a
proportionate one rather than a demand to break the product.

No such mechanism exists. Nothing in the IDE reads a user-supplied ROM, and
removing a bundled image today simply stops that machine booting. The file is
making a promise the code does not keep, to exactly the audience least able to
verify it and most entitled to rely on it.

There is a second, narrower cost. A machine whose firmware carries no
redistribution grant cannot ship at all, so it cannot be finished. The Altair
8800 sits half-built for this reason: its 8K BASIC is Microsoft copyright with
no grant, and its scaffolding is written around a ROM that "is user-supplied and
does not ship here", waiting on a way for the user to supply it.

The machines differ in how much of this they can honour. Some run the ROM image
the IDE hands them and would run a different one; others load their own multi-file
ROM sets internally and would ignore anything supplied. Only the first group can
keep the promise, so only the first group should make it.

## What Changes

- The user can **install their own ROM image** for a machine whose emulator runs
  the image the IDE gives it, from **Settings ▸ Emulator**, and can restore the
  bundled image at any time.
- An image is accepted **only when its size exactly matches** what that machine
  requires, and a rejection **names the size required** — not merely "wrong size".
- An installed image is **kept in the browser**, survives reload, is never
  uploaded anywhere, and is never carried in a share link.
- The override applies **wherever that machine runs in that browser**, including
  the standalone player.
- Machines that load their own ROM sets **say so** rather than offering a control
  that would do nothing.
- Failing to store an image is **reported**. The user is not left believing an
  image was kept when it was not.
- A machine that cannot start because its ROM image is unavailable **points the
  user at supplying their own**, instead of reporting a bare fetch failure. This
  is what the Altair scaffolding is waiting for, and what makes "the bundled
  copies can be removed" true rather than aspirational.
- `public/roms/ATTRIBUTION.md` is **corrected**: the claim stands where it becomes
  true and is withdrawn from the three sections where it does not.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: one requirement added — *The user can supply their own machine
  ROM* — covering installation, exact-size acceptance, restoring the bundled
  image, durability, the reach of the override, and reporting a failure to store.
  One requirement modified — *Works offline* — because an image the user supplies
  needs no prior network fetch, so a machine can become runnable offline without
  ever having been run online.
- `program-execution`: one requirement modified — *One action runs the current
  source* — because booting can now fail for want of a ROM image, and what the
  user is told in that case has to distinguish a missing image from a supplied
  one that does not work.

`dialect-toolchain` is **not** affected: the keyword set, tokenizer and charset
are per-dialect data and are unchanged by which image the CPU executes. A ROM
carrying a different BASIC is out of scope (see Non-goals).

`sharing-player` is **not** affected: no share record gains a field, and the
player's behaviour is unchanged except that it honours a locally installed image
by the same mechanism the IDE does.

## Non-goals

- **Machines that load their own ROM sets.** The jsbeeb-backed Acorn machines and
  the Commodore machines resolve several images internally and ignore the one the
  IDE supplies. Offering them a replacement would need per-slot declarations
  (OS / BASIC / character generator / filing system) and, for jsbeeb, reaching
  into a loader the project deliberately does not fork. A separate change.
- **Replacing part of a machine's firmware.** One image per machine. Slot-level
  replacement is the same future change as the point above.
- **Validating that an image is a working ROM.** Size is the only check.
  Distinguishing a legitimate ROM revision from a corrupt file would need a list
  of known-good images, which is precisely the dependency this feature exists to
  remove. A wrong-but-correctly-sized image produces a machine that does not
  start, and the user restores the bundled one.
- **Making the rest of the IDE follow a different ROM.** Screen reading, variable
  readback and runtime error reports read the stock firmware's layout. An image
  that keeps that layout works; one that does not will make them quiet. Not a
  supported configuration, and not something this change tries to detect.
- **Supporting a different BASIC.** The tokenizer, keywords, charset, memory map,
  samples and build targets stay per-dialect data. An image whose BASIC differs
  from the machine's own will mis-tokenize.
- **Carrying a custom ROM in a share link.** A share is a program, not a machine.
  Recipients run the bundled image unless they have installed their own.
- **Live synchronisation between browser tabs.** An install in one tab reaches
  another when it reloads or switches machines, as every other setting does.
- **Registering the Altair 8800.** This change removes the obstacle its plan
  names; finishing that dialect remains its own work under
  `docs/contributing/dialect-plans/`.

## Impact

Affected code:

- `src/dialects/types.ts` — one additive optional field on `Dialect` declaring the
  exact size of the image a machine runs, present only where the seam's `rom` is
  what the CPU executes. `createEmulator`'s signature and every `MachineEmulator`
  member are unchanged.
- `src/dialects/{zx80,zx81,zxspectrum,zxspectrum128,cpc464,cpc6128}/index.ts` —
  declare that field from each machine's existing ROM-size constant.
- `src/dialects/zxspectrum128/emulator/memory128.ts` — export the constant it
  already defines.
- `src/emulator/cpc/memory.ts` — a wrong-length guard. The CPC is the only machine
  in scope without one; it currently accepts a short image and silently leaves
  half its ROM zeroed.
- `src/storage/customRom.ts` (new) — the per-machine image store, with a write
  contract that reports failure rather than swallowing it.
- `src/components/EmulatorPane.tsx` — prefer an installed image when building a
  machine; rebuild when one is installed or removed; report an unavailable ROM as
  a designed state. Also fixes a latent bug in the ROM fetch cache, which memoizes
  a rejected fetch for the lifetime of the page.
- `src/app/store.ts` — installed-image metadata and the change counter that forces
  the rebuild.
- `src/components/SettingsForm.tsx`, `SettingsForm.module.css`,
  `src/components/customRomUpload.ts` (new) — the Emulator-tab control and its
  validation messages.
- `docs/guide/getting-started.md` — how to supply an image, and its effect on
  offline use.
- `public/roms/ATTRIBUTION.md` — the correction described above.

No dependency changes. No migration: no stored image means the bundled one, which
is what every existing browser has.
