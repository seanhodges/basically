## Why

The IDE hands every registered machine the same virtual filesystem, and four of
them take it and throw it away.

`EmulatorPane` builds each machine with
`createEmulator({ rom, ramKb: 16, files: emulatorVfs })` — unconditionally, for
every dialect. Seven route that store into a trap: the Spectrums at `SA-BYTES`,
the BBCs and the Atom at their filing-system vectors, the C64 at the KERNAL jump
table, the TRS-80 at interpreter statement level. Four — the CPC 464, the CPC
6128, the PET and the VIC-20 — declare `files` in their machine constructor and
never mention it again; the identifier appears exactly once in each of
`cpcMachine.ts`, `petMachine.ts` and `vic20Machine.ts`. Five are never offered it
at all, and one of those, the PMD 85, records every byte a program's `SAVE`
writes into a private array that nothing outside its own unit test can read.

None of this is a violation. The seam's own comment blesses it — *"machines
without such traps simply ignore it"* — and the `persistence` requirement hedges
to the same place: *"data file I/O the machine can intercept"*. Under that
wording a machine that does nothing is compliant, so there is no obligation for
a test to hold it to.

Nor could a test have found it unaided. TypeScript cannot: the machine
constructors do use their `opts` — for `roms` — so `noUnusedParameters` never
fires on the field beside it. A `typeof` conformance check cannot either, the way
`debugCapability.test.ts` checks `debugStep`: `files` is a constructor argument,
and nothing on the returned machine records whether it was kept.

So the fact of which machines capture a program's files is written down nowhere,
checked nowhere, and shows the user nothing. Opening File ▸ Emulator files on a
VIC-20 gives an empty list under the words "Files the running program has saved",
which reads as a program that saved nothing rather than a machine that could
never have said. That is the same silent degradation `memoryActivity.test.ts` was
written to stop for the memory overlay, one seam over.

Now is the moment because `saved-data-appears-in-the-editor` promotes those files
from a modal to live editor tabs. A tab strip that can never populate on four
machines is a worse version of the empty list, and that change needs this fact to
exist before it can read it.

## What Changes

- **A dialect declares whether its machine captures the files a program saves.**
  A hand-declared flag on `Dialect`, in the shape of `debuggable`: the dialect
  claims it, and a test asks the machine whether the claim is true. Seven
  dialects claim it today.
- **The file list says when a machine cannot capture files.** Where the machine
  has no traps, File ▸ Emulator files explains that instead of presenting an
  empty list under copy that implies the program simply saved nothing.
- **A registry-driven battery holds every machine to its claim.** Behavioural for
  the machines that claim it — boot the real ROM, run a BASIC program that writes
  a file and reads it back, assert the store saw the bytes. Structural for those
  that do not: a named exemption carrying the reason, and a guard that the
  exemption set is exactly the set of non-claimants, so a machine that gains
  traps must leave the table and a machine that loses them cannot hide.
- **The four accept-and-drop machines are named as such.** Their exemptions record
  that the store is accepted and dropped — not a hardware excuse — so the entry
  reads as outstanding work rather than as a settled limitation. The same for the
  PMD 85, whose recorded bytes exist and are simply never offered anywhere.
- **The boot harness can hand a machine a store.** `bootMachine` builds machines
  with `{ rom, ramKb }` only today, so every boot test in the suite exercises the
  no-store branch and no registry-driven test can reach file I/O at all.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `persistence`: the *Programs can save and load their own files* requirement
  stops hedging. Where a machine does not intercept a program's file I/O, the IDE
  says so rather than presenting an empty list of files.

## Impact

- `src/dialects/types.ts` — one optional flag on `Dialect`.
- The seven dialect `index.ts` files that trap (`zxspectrum`, `zxspectrum128`,
  `bbcmicro`, `bbcmaster`, `atom`, `commodore64`, `trs80`) declare it.
- `src/components/VfsInspectorDialog.tsx` — reads the flag; new empty-state copy.
- `src/dialects/bootHarness.ts` — `bootMachine` gains a `files` option.
- New `src/dialects/fileIoProbes.ts` and `src/dialects/fileIo.test.ts`.
- Suite cost: the battery boots and runs BASIC on the claimants, the shape that
  costs `loopSpeed.test.ts` ~36s over every machine. Only seven are booted here,
  so budget appreciably less, and the non-claimants cost nothing.

## Non-goals

- **Wiring any machine.** The CPCs, the PET, the VIC-20 and the PMD 85 stay
  exactly as they are. This change makes the gap legible and permanent; closing
  it is separate work, one machine at a time, each landing as an exemption
  leaving the table.
- **A new `MachineEmulator` member.** The capability is a property of the
  dialect's wiring, not a runtime service the app calls, so it is declared and
  crosschecked rather than probed.
- **Proving the negative behaviourally.** Running a file statement on a machine
  with no traps reaches unmodelled hardware and hangs; the exemption is
  structural, and deliberately so.
- **Whole-program `SAVE`/`LOAD`.** The flag is about the data files a program
  writes while running. The BBCs' untrapped `OSFILE`/`OSGBPB` and the Spectrums'
  pass-through of type-0 program saves are unaffected and unclaimed.
- **Changing the store, its lifetime, or how files are displayed.** Those belong
  to `saved-data-appears-in-the-editor`.
