## Why

Most BASIC programs on these machines produce **screen output**, not variables.
A hello-world, a graphics demo, a maze — none of them leave a variable worth
inspecting. So anything that wants to check what a program actually did needs the
screen as characters, and nothing in the IDE can produce that: the only pixel
surface a machine exposes needs a drawing context, which answers "what colour is
this pixel", not "what does it say".

The knowledge exists but is scattered and out of bounds. Nineteen separate
helpers across eighteen test files each read one machine's screen back, and every
one of them reaches around the machine boundary into a concrete emulator's
internals — the exact thing the project's single machine seam exists to prevent.
They cannot be reused by the IDE, they disagree in shape, and each new machine
adds another.

This is the observation channel the assistant needs before it can check anything
about output, and it is the **only** channel for the two machines that cannot
report their variables at all.

> Sequenced after `verify-generated-code-at-runtime`, and a prerequisite for
> `assert-program-results`.

## What Changes

- A machine that can present its screen as text SHALL be able to do so, through
  the same machine boundary every other capability uses. Machines that cannot
  simply do not offer it, exactly as they already decline to report variables,
  audio or debugger state.
- Every registered machine gains the ability, including the two Sinclair machines
  that have no text screen at all and must recover their characters from the
  bitmap by matching the ROM font.
- The scattered per-machine screen readers in the test suite are replaced by the
  one the machines now offer, so the tests stop reaching past the boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-execution`: the existing "Runtime state is visible to the IDE"
  requirement widens — the running program's screen, as text, joins its runtime
  report, its variables and its RAM figures as state the IDE can observe where
  the machine can produce it.

## Impact

- The machine boundary gains one optional member; nothing existing changes shape,
  so every machine that does not implement it keeps working untouched.
- Each registered machine gains a screen reader, derived from the helper its own
  tests already use: a character matrix in RAM on the Commodore, Atom, Tandy and
  Acorn (mode 7) machines, a display-file walk on the two ZX machines, and font
  matching on the two Spectrums, the two Amstrads and the Acorn machines in their
  graphics modes.
- The Commodore family reuses the screen decoding already written for its runtime
  report, which reads the screen today to find error lines.
- The test-local helpers are deleted in favour of the real one, except the few
  that assert on the machine's own encoding rather than on text.
- No new dependencies.

## Non-goals

- **Pixel or graphics readback.** This is characters only. A bitmap comparison is
  a different problem with different uses.
- **Colour, attributes or cursor position.** Text alone.
- **Writing to the screen.** Read-only, like every other introspection the
  boundary offers.
- **A required boundary member.** Machines that cannot answer omit it; callers
  degrade rather than fail.
- **Using it in the assistant.** That is `assert-program-results`; this change
  only makes the screen readable and puts the tests on it.
