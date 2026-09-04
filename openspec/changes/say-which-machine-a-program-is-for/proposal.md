## Why

A BASIC listing does not say which machine it is for, and everything that reads
one has to be told separately: the IDE by its active target, the command line by
an option on every invocation, an external editor by a setting. That is
serviceable when a project is one machine, and it falls apart the moment a
directory holds programs for several — which is the shape this project's own
samples tree has, and the shape anyone porting a program between machines ends
up with. There is nowhere to put the answer except beside the file, and nothing
beside the file travels with it.

The product already has the idea of a source line that carries something other
than BASIC. `#BIN` stands in for a program-area record that cannot be written as
text: dialect-agnostic, contributing no bytes, understood everywhere a listing is
read. A machine declaration is the same shape used for a different fact, and the
same reasoning applies — a listing should be able to carry what is needed to read
it.

Proposed on its own rather than inside `edit-a-program-in-another-editor`, which
wants it first, because it is a change to the source format rather than to any
one reader: it reaches every path that turns text into bytes, and the language
server is only the newest of those paths.

## What Changes

- **A listing can declare the machine it is for**, on a line of its own, naming
  the machine the same way it is named everywhere else in the product.
- **The declaration contributes nothing to the program.** It is not a BASIC line,
  it costs no bytes, it does not affect the RAM budget, and no machine ever sees
  it. Every path that turns text into bytes reads it the same way, through one
  reader rather than one per caller.
- **Naming a machine on the command line becomes optional** for a program that
  declares one. Naming one anyway still works and still wins, because an option
  given for one invocation is a more deliberate instruction than anything written
  in the file.
- **A declaration that is wrong is reported like any other problem** — an
  unregistered machine, or two declarations that disagree, at the line and column
  where the fault is.
- **Switching the target machine keeps the declaration true**, so a program that
  declares a machine and is then moved to another does not carry a lie.

## Non-goals

- **Guessing a machine when nothing declares one.** Inference from the listing
  already exists for sharing and is being consumed by the language server; this
  change adds a way to *state* the answer, not a better way to guess it.
- **Declaring anything else about a program.** No memory bounds, no run options,
  no metadata block. One fact, one line. A listing is a program, not a manifest.
- **Emitting a declaration when a binary is converted back to text.** Converting
  knows the machine and could write one, which would be useful; it belongs with
  `convert-programs-from-the-command-line`, which owns that path and has not
  landed.
- **Showing the declaration as anything other than the text it is.** Rendering it
  as a chip the way `#BIN` lines are rendered is an editor affordance that can
  follow; it is not needed for the declaration to work.
- **Making the declaration required, or writing one into existing programs.** A
  listing without one behaves exactly as it does today.
- **Cross-dialect translation.** Declaring a different machine does not port a
  program to it; it says which machine to read it as, and the problems reported
  are then that machine's.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialect-toolchain`: a listing gains a way to declare the machine it is for,
  which every path that turns text into bytes honours and none of which turns
  into bytes.
- `headless-cli`: naming a machine stops being required for a program that
  declares one, and stays available for a caller who wants to override it.

## Impact

**`edit-a-program-in-another-editor` wants this**, and is written to work without
it. That change binds an editor's document to a machine by declaration first,
then configuration, then inference; until this lands it simply starts at
configuration. Neither change blocks the other.

**One reader, above the seam.** The declaration must be honoured by everything
that turns a listing into bytes — running, exporting, sharing, checking, the byte
count the RAM budget is measured against — and a path that misses it is a program
that behaves differently for its author than for anyone else. So the reading and
the stripping happen once, above the `Dialect` seam, and no tokenizer learns
about it. `refer-to-blocks-by-name` reaches the same conclusion for the same
reason and names the same risk; the two want the same single point, and whichever
lands first should build it so the second can use it rather than adding a
parallel one.

**Column positions.** Removing a line above the seam moves every line after it,
so a problem the tokenizer reports would land on the wrong line unless the
mapping is carried back. This is the same obligation `refer-to-blocks-by-name`
takes on for substituted text within a line, one axis over.

**Every registered machine.** The declaration is dialect-agnostic and must
tokenize away to nothing on all of them, so the check is registry-driven: every
machine, every one of its own bundled samples, with and without a declaration,
producing identical bytes.

**No new dependency.** The reader is a leaf module in the shape of
`src/dialects/binaryDirective.ts`, importing nothing but a type. Nothing is added
to any bundle and there is no licence to check.
