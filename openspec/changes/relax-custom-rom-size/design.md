## Context

The custom-ROM feature (see the archived `add-custom-rom-upload` change) checks a
picked file's length against `Dialect.romBytes` and refuses a mismatch. That
check exists for a mechanical reason rather than a product one: the machines
that run a supplied image build their memory from the buffer they are given and
throw on a wrong length (`Zx81Memory`, `Zx80Memory`, the two Spectrum memories,
`CpcMemory`). Refusing the file at the picker was the cheapest way to keep a
mismatched buffer away from those constructors.

Removing the requirement therefore means answering the constructors, not just
deleting the message.

## Goals / Non-Goals

**Goals**

- Any file the user picks can be installed and run.
- The machine's ROM area is filled deterministically, whatever the file's size.
- The user can still tell, after the fact, that their file did not match the
  area — the one genuinely useful part of the old refusal.

**Non-goals**

- Per-bank or offset placement of a short image (see the proposal's non-goals).
- Any judgement about whether an image is a plausible ROM.

## Decisions

**Fit at the seam, not in the machines.** The image is fitted in
`src/app/romImage.ts` and handed to `createEmulator` already the right length,
so every machine's constructor keeps its existing length guard. The alternative —
relaxing each guard — would spread the policy across six machines (one of them
under `src/emulator/`, shared with the CPC pair), let each drift, and weaken a
check that still catches a genuinely wrong buffer arriving from anywhere else.
The `Dialect` / `MachineEmulator` seam is unchanged: `createEmulator` still
receives a buffer of exactly `romBytes` length, which is what it has always
promised.

**Pad with `0xFF`, trim from the end.** `0xFF` is what an unprogrammed EPROM
reads as, so a short image behaves the way the same image would in real
hardware: the machine runs what was supplied and finds erased space past it.
Padding with `0x00` would instead present a run of `NOP`s (Z80) or `BRK`s
(6502), which is both less faithful and harder to recognise. A longer file keeps
its leading bytes because that is where an image with trailing padding, a
checksum block or a second bank the machine cannot address puts the part that
runs.

**Fit on load, store verbatim.** What the user supplied is what is kept and what
the readout describes; the fit happens each time a machine is built. That keeps
the stored record honest (its `size` is the file's own size, which the readout
names), and means a machine whose `romBytes` changes later re-fits the same
image instead of having been silently rewritten at install time.

**A supplied image makes its machine offerable.** `machineAvailability` asked
whether the stored image matched the machine's size, because a mismatched one
could not boot. Any image can now boot, so the question becomes whether one is
installed at all. The image may of course be nonsense — but that is equally true
of a correctly-sized one, and the emulator pane's "didn't start on your own ROM"
message is what covers it.

## Risks / Trade-offs

- **A user installs a file that is not a ROM and gets a dead machine.** Already
  possible with a correctly-sized file; the failure is reported by name and
  *Restore bundled ROM* undoes it. The readout naming the padding is what tells
  a user who supplied one bank of a two-bank image why it did not work.
- **Silent truncation of a large file.** Mitigated by stating it in the readout
  ("trimmed to 32,768") rather than only in the fit.

## Migration Plan

None. Existing stored images match their machine's size and are unaffected by
the fit; nothing is rewritten, and no stored field changes meaning.

## Open Questions

None.
