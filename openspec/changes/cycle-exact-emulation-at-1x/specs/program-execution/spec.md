## MODIFIED Requirements

### Requirement: Emulation runs at authentic speed with sound

While running, the machine SHALL advance in display-frame steps at the
machine's own native frame rate measured against real time, render to the
visible screen each frame, and play the machine's sound where the machine
produces any. How often the browser is able to repaint SHALL NOT change how much
emulated time passes per second, so a program takes the same wall-clock time to
run regardless of the display's refresh rate.

Where the host cannot emulate a machine as fast as real time, emulation SHALL
fall behind rather than skip ahead, and SHALL bound how much lost time it tries
to reclaim, so a stall never repays itself as a burst of fast-forward.

The machine's sound SHALL play at the pitch the machine produces and SHALL NOT
accumulate delay over a long run.

The user SHALL be able to scale emulation speed and mute or adjust the volume.
Scaling the speed SHALL change how often the machine's frames advance, leaving
each frame's own timing — and therefore anything the machine derives from it —
as it is at real time.

#### Scenario: Speed multiplier

- **WHEN** the user sets the emulator speed to a multiple of real time
- **THEN** the running program advances proportionally faster or slower

#### Scenario: A display that refreshes faster than the machine

- **WHEN** a program runs on a display whose refresh rate is higher than the
  machine's frame rate
- **THEN** the machine still advances at its own rate in real time, rather than
  running fast

#### Scenario: A host that cannot keep up

- **WHEN** the host cannot emulate frames as fast as real time
- **THEN** the program runs slow, and the time lost is not repaid as a burst of
  accelerated emulation once the host recovers

#### Scenario: Sound over a long run

- **WHEN** a program produces sound continuously at real-time speed
- **THEN** the sound stays at the machine's own pitch and does not drift
  progressively further behind the picture
