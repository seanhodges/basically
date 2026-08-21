## Why

On the PMD 85 a tap on the on-screen keyboard often sends its character several
times. Nothing in the emulator is wrong: the key matrix, the Monitor's scan and
its auto-repeat all behave as the hardware does. Booting the real ROM and
holding one key shows what the machine promises — the character lands on the
first frame, a second follows 38 frames (0.76s) later, and after that one every
four frames, about thirteen a second.

That is a bargain struck with a physical keyboard, where a finger feels the key
bottom out and lifts. On glass there is nothing to feel: a press that looks like
a tap rests for the best part of a second, and the machine does what it was
always going to do. Measured through the running app, a press under 700ms sends
one character, 800ms sends three, and 1.5s sends twelve.

The virtual keyboard is where this has to be answered, because it is the only
part of the chain that knows the press came from a fingertip rather than from a
key with a spring under it.

Affected capability spec: `openspec/specs/virtual-input/spec.md`.

## What Changes

- A press on an on-screen key drives the machine's matrix for a bounded time
  rather than for as long as the pointer happens to rest on it, so one tap sends
  one keypress however long the finger lingers.
- How long that is comes from the machine's own layout data, so a machine whose
  ROM repeats sooner can ask for less; a machine that asks for nothing keeps
  today's behaviour, where the press lasts exactly as long as the pointer does.
- The PMD 85 asks for it, at a ceiling its own ROM's measured repeat delay sits
  clear of.
- Function keys and modifiers are unaffected: they stay held for as long as the
  touch does, because programs read them as held state and a chord needs its
  modifier to outlast the key.

## Non-goals

- **No change to any machine's emulated keyboard.** The matrix, the scan and the
  ROM's auto-repeat stay exactly as the hardware behaves; a host keyboard held
  down still repeats, on every machine, at the machine's own rate.
- **No change to the game controller.** A held d-pad or fire button is held
  state a game reads, and it keeps its own timing.
- **No IDE-side key repeat.** The virtual keyboard does not start repeating a
  machine key itself once the ceiling is reached; the user taps again. (The
  editor target's existing hold-to-repeat on cursor and delete keys is
  untouched.)
- **No ceiling for the other machines yet.** Several ROMs repeat sooner than the
  PMD 85's — the mechanism is theirs to opt into, one measured number each, when
  someone has measured them.
