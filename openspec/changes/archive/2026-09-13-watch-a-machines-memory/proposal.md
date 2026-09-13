## Why

The IDE's memory map is the most direct picture the product gives of a program
actually working: the machine's whole address space as colour-coded bands, and
over them the addresses the CPU is touching right now - teal where it read,
coral where it wrote, fading as they go. Every machine with a bus to tap records
it, and a registry-driven test holds them all to doing so.

None of it leaves the browser. The seam it is drained through is on the emulator
object, and the only thing that drains it is a React hook holding that object
directly. No operation answers it, nothing crosses the thread the machine runs
on, and no projection carries it - so an editor, an agent or the command line
watching a program run can see its screen and read its variables, but has no way
to see where in memory the program is living.

The map itself already travels: `info` answers the whole region table, on every
surface. It is only the live half that stops at the browser.

## What Changes

- **A caller holding a machine can ask for a map of it**, and is given an
  address anything that shows a web page can be pointed at - the same bargain
  `view` and `play` already offer, for a third thing to look at.
- **What is at that address shows the machine's memory layout and what the
  machine is touching**, following the program as it runs.
- **A map is not a display, so it does not displace one.** A view and a play
  channel are two ways of showing the same screen and a machine has one or the
  other; a map shows something neither of them shows. It may be open beside
  either, and opening it ends neither. This is what makes the map worth having
  at all: a held machine advances unasked only while it is being played, so a
  map that ended the play channel would show a still picture of a stopped
  machine.
- **A machine that cannot be mapped says which way it cannot.** A machine whose
  layout the toolchain does not describe has no map to project. A machine with a
  layout but no bus to tap has a map that shows no activity. They are different
  answers and are given as different answers, rather than as one empty picture.
- **Watching a machine's memory changes nothing about it.** Recording is armed
  only while something is watching, draining spends none of the machine's
  frames, and what the tap costs the host is taken back out of the run's
  reported time - so a mapped run measures as an unmapped one.
- **The overlay the IDE has always drawn is stated as a guarantee.** It is
  implemented and unspecified; this is where it is written down, for the IDE and
  the projection alike.
- No operation is removed or renamed, nothing changes for a caller that asks for
  no map, and no machine behaves differently. **Not breaking.**

## Non-goals

- **Reading memory contents.** Nothing here reads the byte at an address. The
  seam records which addresses were touched and whether the access was a read or
  a write; it carries no values, and no member that would return one is added to
  `MachineEmulator` or to anything a session exposes.
- **Writing memory.** Not at an address, not through a map, not at all.
- **The addresses a program writes to.** The amber POKE and blue `LOAD CODE`
  markers on the IDE's map come from reading the program's source, not from
  asking the machine. They belong to the editor that holds the source and are no
  part of what a projection of a running machine shows.
- **Live RAM figures.** What a machine says is used and free is a different
  question with a different answer, already reported where a run is measured.
- **Changing what a view or a play channel is.** Each keeps every guarantee it
  makes, including that a machine has one or the other of them.
- **The editor clients.** Pointing a frame at the address is a change in
  `basically-editor-extensions` and is not this one. What is guaranteed here is
  that the address exists and that what is at it can be framed.
- **Making a machine mappable that is not.** A machine with no described layout,
  or no bus to tap, is said to be one. This changes what may be asked, not which
  machines can answer.

## Capabilities

### New Capabilities

- `memory-view`: a caller holding a machine may ask for a map of its memory and
  is given an address; whoever holds that address watches the memory and can do
  nothing else; the map exists only while it has been asked for, is reachable
  only from the computer the host runs on, and changes no measurement taken of
  the machine.

### Modified Capabilities

- `display-view`: the rule that a machine has a view or a play channel and not
  both is about the **display**. A map of the machine's memory is a third
  projection, showing what neither of those shows, and neither ends it nor is
  ended by it.
- `memory-map`: the map shows what the running machine is touching, reads told
  apart from writes and recent activity from old; a machine that cannot report
  what it touches says so rather than showing a map with nothing on it.

`machine-play` is deliberately absent. What a played machine costs the requests
about it is unchanged: asking for a map is a read, answered on the terms that
capability already sets for reads, and the clock it describes is untouched.
`headless-cli` and `mcp-server` are absent for the same kind of reason - their
rule is already that every operation the toolchain offers is offered there, which
a new operation satisfies rather than changes.

## Impact

- **A third projection**, beside `src/server/view/` and `src/server/play/`,
  served from the one listener those two already share and admitted the same
  way: loopback only, an unguessable address, and no route that accepts anything
  from whoever holds it.
- **A tap beside the frame tap**, in `src/dialects/headless/`, armed only while
  something is watching and folded into the same per-frame step the display's
  sampling already folds into - so it covers a machine being played, run,
  stepped and continued without a second path.
- **The thread the machine runs on** gains one more thing it says unprompted,
  alongside the frames it already sends.
- **One more operation**, declared once and therefore offered to the command
  line and to an agent at once, with a written reason for the one caller that
  deliberately lacks it.
- **The `Dialect` / `MachineEmulator` seam is unchanged.** Every member this
  needs is already declared, already owed by every machine with a bus to tap,
  and already held to by a registry-driven test. Nothing is added to it and
  nothing about it moves.
- **The documentation** of what the host projects, which is written as a table
  of two and becomes a table of three.
