## Why

The target machine is chosen in two places, and they have nothing in common.

The New-project dialog lists **every** machine inline — five manufacturer rows of
chips, twelve machines — so the machine section is physically the largest thing
in the dialog, and it is the one decision most people will simply accept the
default for. It reads as a wall of names before the heading has been read.

The toolbar switches machines through a plain dropdown that is flat and
alphabetical: it drops the manufacturer grouping, the release year and the
one-line description that the New-project list carries. So the surface where a
machine is *most* likely to be picked by someone unfamiliar with these computers
is the one that describes them *least* — while the surface that describes them
well is the one shouting a list nobody asked for.

Both problems have the same fix: collapse the list to the machine you are on,
and put the full description behind one press — in one component, used in both
places.

## What Changes

- **Collapsed by default:** creating a project shows only the chosen machine, as
  a control carrying its illustration, name, manufacturer and year. Pressing it
  opens the machine list.
- **New:** one machine picker, shown wherever a machine is chosen. It groups
  machines under their manufacturer and gives each row an illustration, its
  release year and its one-line description — so every machine is described at
  the moment of choosing, not just the selected one.
- **Illustrations:** each machine is drawn in its own colours (the Spectrum's
  rainbow flash, the C64 breadbin, the BBC's red function strip, the PET's green
  screen), so machines are recognisable at a glance rather than by name alone.
- The toolbar's flat alphabetical target dropdown becomes a target machine
  control — illustration plus name — that opens the same picker. Switching from
  there still raises the existing confirmation when the user's own code is at
  stake; nothing about what happens to their program changes.
- At narrow widths the toolbar control drops to the illustration alone, keeping
  the machine identifiable where the name no longer fits.

## Non-goals

- No change to the `Dialect` / `MachineEmulator` seam, and no new field on
  `Dialect`. Illustrations are a UI concern keyed by dialect id.
- No change to what happens to the user's program when the machine changes: the
  keep-my-code / start-new confirmation and its rules are untouched.
- No new machines, and no change to which machines are offered.
- Not a redesign of the New-project dialog's other choices (name, starting
  point) or of any other dialog.

## Affected specs

- `project-setup` — how the target machine is presented and chosen.
- `dialect-toolchain` — switching target now goes through the same picker.
