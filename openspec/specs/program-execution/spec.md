# program-execution Specification

## Purpose

Run the current program on an authentic in-browser emulation of the selected
machine: one action takes the editor's source to a running program on the
machine's screen, with sound, adjustable speed, and a line-level debugger
where the machine supports one.

## Requirements

### Requirement: One action runs the current source

A single Run action SHALL tokenize the current source, load it into the
machine (booting the machine first if needed), and start it running, without
the user performing any machine-side loading steps.

The current source SHALL be the buffer the editor is showing: the program, or a
scratch buffer when the user is looking at one. Running a scratch buffer SHALL
leave the program unchanged, and SHALL carry the document's memory blocks, so a
snippet can call into machine code the document holds. It SHALL NOT carry the
tape files, auto-start line or verbatim disc image preserved from how the
document was imported, and a document that boots such an image verbatim SHALL
still run a scratch buffer when one is showing.

Where the machine runs a ROM image the user can supply, and no image is
available to boot from, the IDE SHALL say that the machine's ROM image is
unavailable and point the user at supplying their own, rather than reporting a
bare fetch failure. Where a run fails while an image the user supplied is in
force, the IDE SHALL say that too, so a ROM that does not work can be told
apart from a program that does not work.

#### Scenario: Run from the editor

- **WHEN** the user invokes Run on a valid program
- **THEN** the program is executing on the emulated machine within the
  emulator pane

#### Scenario: Run a scratch buffer

- **WHEN** the user invokes Run while a scratch buffer is the one on screen
- **THEN** the snippet is executing on the emulated machine, and the document's
  own program is unchanged

#### Scenario: A snippet calls into the document's machine code

- **WHEN** a scratch buffer calls machine code held in one of the document's
  memory blocks
- **THEN** those blocks are loaded with it and the call reaches them

#### Scenario: A scratch buffer on a document that boots a disc image

- **WHEN** the user invokes Run on a scratch buffer while the document is one
  that boots a preserved disc image verbatim
- **THEN** the snippet runs, rather than the document's disc image booting

#### Scenario: The machine has no ROM image to boot from

- **WHEN** the user runs a program on a machine whose ROM image is unavailable
- **THEN** they are told the image is unavailable and that they can supply their
  own, rather than being shown a fetch failure

#### Scenario: A run fails while a supplied ROM is in force

- **WHEN** a run fails on a machine running a ROM image the user supplied
- **THEN** the IDE reports that a supplied image is in use, so it can be told
  apart from a fault in the program

### Requirement: Runs are gated on known-bad input

The Run action SHALL refuse to start when the source has lint errors (while
the lint gate setting is enabled) or when the document's memory blocks
conflict with the machine or the program, and SHALL tell the user why.

#### Scenario: Lint error blocks the run

- **WHEN** the user invokes Run while the source has a tokenizer error
- **THEN** no program is loaded and the error is surfaced instead

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

### Requirement: The machine accepts live input

A running program SHALL receive keyboard input from the user's physical
keyboard and from the on-screen input devices, and joystick input where the
machine has a joystick interface.

#### Scenario: Typing into a running program

- **WHEN** a running program waits for input and the user types on their
  keyboard
- **THEN** the program receives the machine's corresponding key presses

### Requirement: Runtime state is visible to the IDE

Where the machine can introspect them, the IDE SHALL surface the running
program's BASIC runtime report (errors), its variables, its actual RAM usage,
and the contents of its screen as text; machines that cannot report a figure
fall back gracefully rather than showing stale data.

Screen text SHALL be the characters the program put on the screen, in reading
order, for every machine that can determine them — including machines whose
display holds no characters, where they SHALL be recovered from what is
displayed.

#### Scenario: Live memory readout

- **WHEN** a program is running on a machine that reports RAM figures
- **THEN** the status display shows the machine's own used/free figures
  instead of the pre-run estimate

#### Scenario: Reading back what a program printed

- **WHEN** a program has printed to the screen on a machine that can report its
  screen as text
- **THEN** the printed characters are available to the IDE in reading order

#### Scenario: A machine whose display holds no characters

- **WHEN** a program has printed to the screen on a machine that stores its
  display only as an image
- **THEN** the printed characters are still reported, recovered from what is
  displayed

#### Scenario: A machine that cannot report its screen

- **WHEN** the IDE asks a machine that cannot determine its screen text
- **THEN** no screen text is reported, and every other runtime figure is
  unaffected

### Requirement: The machine's screen can be saved as an image

Wherever the IDE shows a machine's screen, the user SHALL be able to save what
that machine has drawn as an image file.

The saved image SHALL be the machine's own picture and nothing else: its own
pixels, at its own display size, with no interpolation, no surrounding chrome —
no bezel, no panel, no on-screen input device — and no display treatment the IDE
draws over the screen, whatever the user's display settings. It SHALL be
enlarged by a whole number, so that every machine pixel remains a square block
of the same size and the file is legible at ordinary viewing sizes rather than
arriving as a thumbnail.

The saved image SHALL be named after the program it came from, and SHALL be
distinguishable from an image saved of the same program a moment earlier.

A machine that has stopped SHALL still yield the last frame it drew. Asking for
an image of a machine that has not yet drawn a frame SHALL tell the user there
is nothing to save, rather than saving an empty picture.

#### Scenario: Save what a program drew

- **WHEN** the user asks to save a screenshot while a program is running
- **THEN** an image file of the machine's screen is saved, at a whole-number
  enlargement of the machine's own pixels

#### Scenario: The picture is the machine's and nothing else

- **WHEN** the user saves a screenshot on any machine
- **THEN** the image shows what that machine drew, without anything that
  surrounds the screen in the IDE or is drawn over it

#### Scenario: A display treatment does not reach the file

- **WHEN** the user saves a screenshot while the IDE is drawing a display effect
  over the screen
- **THEN** the image is the machine's untreated output

#### Scenario: Saving after the program stops

- **WHEN** the user stops a program and then asks to save a screenshot
- **THEN** the last frame the machine drew is saved

#### Scenario: Nothing has been drawn yet

- **WHEN** the user asks to save a screenshot before the machine has drawn a
  frame
- **THEN** they are told there is nothing to save, and no file is produced

#### Scenario: Two screenshots of the same program

- **WHEN** the user saves a screenshot of a program and then saves another
- **THEN** both files are kept, each identifiable as a screenshot of that
  program

### Requirement: Line-level debugging on capable machines

On machines that support it, the user SHALL be able to set breakpoints on
BASIC line numbers, pause execution before a breakpointed line, see the
paused line highlighted in the editor, and step line by line or continue.

Breakpoints SHALL belong to the buffer they were set on: setting one on a
scratch buffer SHALL NOT affect the program's breakpoints, or those of any other
scratch buffer, and the breakpoints shown in the editor SHALL be those of the
buffer on screen. Discarding a buffer SHALL discard its breakpoints with it.

A run that has begun SHALL keep pausing on the breakpoints of the buffer that
started it, even if the user looks at a different buffer while it runs. The
paused line SHALL be highlighted only while the buffer that is running is the
one on screen, so a pause is never marked against unrelated code.

#### Scenario: Hit a breakpoint

- **WHEN** a debugged program reaches a line with a breakpoint
- **THEN** execution pauses before that line and the editor highlights it

#### Scenario: A snippet is debugged on its own breakpoints

- **WHEN** the user sets a breakpoint in a scratch buffer and runs it
- **THEN** execution pauses there, and the program's own breakpoints are
  unchanged

#### Scenario: Looking at another buffer while a program is paused

- **WHEN** the user switches to a different buffer while a debugged run is
  paused
- **THEN** the run keeps the breakpoints it started with, and no line of the
  buffer now on screen is marked as the paused line

### Requirement: Every machine reports whether a program is running

Every machine the IDE runs SHALL report whether a BASIC program is executing.
This is not a figure a machine may decline to produce: a machine that cannot
answer it cannot be run by the IDE.

A machine SHALL report that a program is running from the point it has taken the
program until the point its BASIC has stopped running it, and SHALL report that
none is running thereafter. Before it has taken the program — while it is still
booting, or still being handed the program — it SHALL report that the question is
not yet answerable, so that the interval between being given a program and
starting it is never read as the program having finished.

A machine SHALL reach a definite answer within a bounded time of being handed a
program that terminates. Reporting "not yet answerable" indefinitely SHALL NOT
satisfy this requirement.

A program waiting for the user to type something SHALL be reported as running.
Waiting for input is what the program is doing, not evidence that it has
stopped.

#### Scenario: A program that finishes

- **WHEN** a program runs to its end on any machine
- **THEN** that machine reports that no program is running, within a bounded
  time of the program ending

#### Scenario: A program that keeps going

- **WHEN** a program loops indefinitely
- **THEN** the machine goes on reporting that a program is running

#### Scenario: A program waiting for input

- **WHEN** a program stops at a prompt for the user to type a value
- **THEN** the machine reports that a program is running, not that it has
  finished

#### Scenario: A program stopped by the user at the machine

- **WHEN** the user interrupts a running program using the machine's own
  interrupt key
- **THEN** the machine reports that no program is running

#### Scenario: The machine has not started the program yet

- **WHEN** the IDE has handed a machine a program but the machine has not begun
  running it
- **THEN** the machine reports that the question is not yet answerable, rather
  than reporting that no program is running

#### Scenario: A program that ends immediately

- **WHEN** a program finishes as soon as it starts, before the machine has been
  observed running it
- **THEN** the machine still reports that no program is running, rather than
  reporting the question unanswerable indefinitely

### Requirement: A run can be paused and continued

On the machines that support line-level debugging, the user SHALL be able to
pause a running program and continue it. Pausing SHALL be offered on exactly
those machines, so that a run can always be released by the same Continue the
machine already offers; a machine that cannot be stepped SHALL NOT offer a
pause.

A pause SHALL hold the machine still rather than end it. The program's memory,
the files it has written, what its screen was showing and the measurements
taken of it so far SHALL all be as the pause found them when the run carries
on. A pause SHALL NOT be a stop: stopping a paused run SHALL end it exactly as
stopping a running one does.

Continuing SHALL carry the run on from where it was paused, however the pause
was reached. A run paused at a breakpoint SHALL continue to the next
breakpoint; a run the user paused SHALL continue freely.

No emulated time SHALL pass while a run is paused, and none SHALL be repaid as
a burst of accelerated emulation when it continues, so a pause changes no
figure the IDE reports about the program.

A pause SHALL be refused where it would leave the IDE waiting on a run that can
no longer proceed: while the IDE is running a program to check an assistant's
answer, while the assistant is driving the machine itself, and before the
machine has drawn its first frame.

Where a run is paused, continuing it SHALL remain available regardless of what
the machine now selected offers, so no pause is left with no way out.

#### Scenario: Pause a running program

- **WHEN** the user pauses a running program
- **THEN** the machine holds its screen, memory and files as they were, and
  stops advancing

#### Scenario: Continue a paused program

- **WHEN** the user continues a program they paused
- **THEN** it carries on from where it was, with the state it had when it was
  paused

#### Scenario: Continue from a breakpoint

- **WHEN** the user continues a program that is paused at a breakpoint
- **THEN** it runs on to the next breakpoint, rather than running freely to the
  end

#### Scenario: A pause the user took is on no line

- **WHEN** the user pauses a running program away from any breakpoint
- **THEN** the program pauses and can be continued, and no line is reported as
  the paused line

#### Scenario: A machine with no debugger offers no pause

- **WHEN** a program is running on a machine that offers no line-level
  debugging
- **THEN** no pause is offered for it, and the run control goes on offering to
  run the program

#### Scenario: A pause does not distort the figures

- **WHEN** the user pauses a running program, waits, and continues it
- **THEN** the time spent paused is charged to neither the program nor any of
  its lines, and the machine does not run fast to catch up

#### Scenario: Stopping a paused program

- **WHEN** the user stops a program that is paused
- **THEN** the run ends as stopping a running program does

#### Scenario: A run started to check an assistant's answer

- **WHEN** the IDE is running a program to check an answer the assistant gave
- **THEN** that run cannot be paused, and the check reaches its verdict

### Requirement: The primary run control shows the state of the run

The primary run control over the editor SHALL show which of the three states
the run is in — stopped, running, or paused — and SHALL act on the state it
shows: starting the program when stopped, pausing it when running, and
continuing it when paused.

Where the machine offers no pause, the control SHALL go on offering to run the
program, as it does when the run is stopped.

The control SHALL show the paused state however the pause was reached, so a run
stopped at a breakpoint is offered the same continue as one the user paused.

Carrying a paused run on SHALL be called the same thing wherever it is offered.

Once the program has ended - it finished, or it stopped on an error - the
control SHALL offer to run it again, even though the machine goes on running at
its prompt. Pausing and continuing are offered against a program, and there is
no longer one to hold still or to carry on. This SHALL hold on every machine,
since every machine reports whether a program is running.

#### Scenario: The control follows a run it started

- **WHEN** the user starts a program from the run control over the editor
- **THEN** that control offers to pause the program while it runs, and to
  continue it once paused

#### Scenario: The control follows a breakpoint pause

- **WHEN** a debugged program stops at a breakpoint
- **THEN** the run control over the editor offers to continue it

#### Scenario: The control does not restart a running program

- **WHEN** the user uses the run control over the editor while a program is
  running
- **THEN** the program pauses, rather than restarting from the beginning

#### Scenario: The control follows the program to its end

- **WHEN** a program the user is watching finishes, leaving the emulator at its
  prompt
- **THEN** the run control over the editor offers to run the program again,
  rather than going on offering to pause a program that has ended

#### Scenario: The control returns to the program on every machine

- **WHEN** a program ends on any registered machine
- **THEN** the run control over the editor offers to run the program again,
  without the user having to stop the run first

### Requirement: A machine has only the memory it shipped with

An emulated machine SHALL hold memory only where the machine it models held it.
Address space the machine could address but never populated SHALL behave as it
did on the hardware: a write there SHALL have no effect, and a read SHALL NOT
return anything the program wrote.

Where a machine was sold in several memory configurations, the IDE SHALL model
one of them and SHALL be consistent about which — the same configuration the
machine's memory map draws and its RAM budget is measured against.

#### Scenario: Writing to memory the machine does not have

- **WHEN** a running program writes a byte to an address the machine's
  configuration leaves unpopulated
- **THEN** the byte is not stored, and reading the address back does not return
  it

#### Scenario: Memory the machine does have

- **WHEN** a running program writes a byte anywhere inside the machine's fitted
  RAM
- **THEN** the byte is stored and reads back unchanged

#### Scenario: Re-running does not grow the machine

- **WHEN** the user runs a program, then runs it again
- **THEN** the machine holds memory in exactly the same places on the second run
  as on the first
