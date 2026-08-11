## Context

The assistant's system prompt leads with a machine description composed from
the shared reference data — the same tables the documentation site renders and
the porting comparison diffs. That seam is the point: what the assistant is
told and what the user is shown cannot disagree, because both are read out of
one source.

The comparison has since grown three facts the description never picked up.
Each is already on the assistant's own code path — the port report loads the
same facts entry and takes the same memory map off the same `Dialect` — so
this is a hand-over that was not made, not data that has to be found.

See `docs/contributing/architecture.md` for how the reference layer sits
beside the dialects.

## Goals / Non-Goals

**Goals**

- The standing description carries the boot screen's geometry, the machine's
  timing and its memory layout.
- One way of writing an address across the standing description and the port
  findings, which are read as one document.
- Byte-stability per machine preserved: every new section is derived from
  module-level constants through pure functions in a fixed order.

**Non-Goals**

- Anything on the port path, which already carries all three for the program
  in hand.
- A live view of memory, or any reach into a running emulator.

## Decisions

### 1. The memory layout is passed in, not looked up

`machineDescription.ts` never reaches the dialect registry — it takes an
identity and its reference tables and returns a string. The memory layout
lives on the `Dialect`, so it arrives the same way the tables do: as an
argument the caller supplies. `src/ai/machineReference.ts` holds the
`Dialect` already, and `portDescription.ts` takes the maps on `PortSide` for
exactly this reason.

The parameter is optional. One registered machine declares no layout, and a
machine without one is described without the section rather than with an empty
heading — the same rule the character-set section already follows, and the
same one the porting guide follows when it draws no maps.

*Alternative rejected:* importing the registry here. It would put every
dialect and its emulator behind a module whose whole value is that it is pure
data in, string out, and would drag the registry into the documentation
build.

### 2. Half a layout is worse than none

The regions are listed complete or not at all. A partial list is actively
misleading: an address absent from it reads as an address the machine does not
have, which is a stronger and wronger claim than saying nothing. This is why
the sweep in the test is the completeness check the keyword list already gets
— every region a dialect declares must appear.

### 3. Read-only memory is marked from the region's kind

Most ROM regions carry a note that says they are read-only; not all of them
do. The marker is derived from the region's kind rather than left to prose,
because ROM is the one region where a write is accepted and does nothing at
all — the failure that produces no error and no output.

### 4. The address formatter is shared, not copied

An address is written in the machine's own notation — `&FC00` on a BBC,
`53280` on a C64. The port describer had this; the machine description needs
the same. It moves to `machineDescription.ts`, which `portDescription.ts`
already imports for its domain titles, so the dependency direction is
unchanged. A reader who had to work out that `&5C00` and `23552` are one
address would be doing the work these sections exist to save.

### 5. Timing sits above the command list

The command list is the longest section by an order of magnitude. A delay is
decided while the program is being planned, so the timing section goes with
the hardware facts it belongs to and above the list, rather than after it
where it would be buried.

### 6. Absent facts stay absent

A machine this project cannot benchmark has no measured rate, and none is
invented for it — the wait idiom stands alone. This is how doubt runs
everywhere else in the reference data, and the comparison already declines to
report delays where either side's speed is missing.

## Risks / Trade-offs

- **Prompt size.** The layouts run five to fourteen regions; the largest
  addition is a few hundred tokens against a description already carrying a
  machine's entire command set. It is static per machine, so it sits inside
  the cached prefix and is paid for once per machine per session.
- **A wrong region note now reaches generated code**, where before it only
  reached a viewer a user could read sceptically. The notes are the same ones
  the memory-map viewer and the hardware pages show, and the map crosschecks
  already hold each dialect's regions to covering its address space.

## Migration Plan

None. Composition-only change behind an existing seam; no stored data, no
share format, no dialect contract.

## Open Questions

None.
