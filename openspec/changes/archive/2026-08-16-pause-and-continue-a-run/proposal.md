## Why

A run has three states — stopped, running, paused — and the round Run button
that overlays the editor on the touch layout knows only one of them. It is
always a green Play, whatever the machine is doing, so tapping it mid-run
silently restarts the program the user was watching.

That leaves the touch layout with no way to pause a run at all. The only pause
the IDE has is the debugger's breakpoint pause, and the controls that carry it
on live in the desktop toolbar and the overflow menu — not on the button the
user is already looking at. So a phone user can start a program and stop it,
but cannot hold it still to read the screen, and when a breakpoint pauses one
for them, the button over the editor gives no sign that it happened.

## What Changes

- The run control over the editor reflects the state of the run and drives it:
  green **Play** when stopped, blue **Pause** while running, blue **Continue**
  while paused.
- A running program can be paused from that control on the machines that offer
  line-level debugging — the same machines whose toolbar offers a Continue to
  release the pause. A pause holds the machine still: its memory, its files, its
  screen and its measurements are all there when the run carries on.
- A machine with no debugger offers no pause, and its control stays the plain
  Play it is today.
- When the program ends by itself — it finishes, or it stops on an error — the
  control goes back to the green **Play**, ready to run it again. The emulator
  stays on at its prompt; what has ended is the program, and Pause and Continue
  are offered against a program. On the machines that cannot see a program
  finish, nothing reports one, so the control goes on offering the pause until
  the run is stopped.
- **Continue** carries a paused run on however it was paused. A run paused at a
  breakpoint continues to the next breakpoint; a run paused from the button
  continues freely. One name, one action — "Continue" is already the IDE's word
  for this, and a pause is a pause whichever way it was reached.
- Pausing is refused in the cases where it would strand something: on a machine
  with no debugger to release it, while the IDE is running a program to check an
  assistant's answer, while the assistant is driving the machine itself, and
  before the first frame has been drawn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `program-execution`: a run on a debuggable machine gains a pausable middle
  state — a running program can be paused and continued without losing what it
  has done, the breakpoint pause and the user's own pause are continued by the
  same action, and the primary run control over the editor shows which of the
  three states the run is in, following the program to its end rather than the
  machine that outlives it.

## Impact

- **Run loop and store**: the emulator pane gains a pause step — it stops
  scheduling frames and reports the run as paused — and the store gains one
  request counter for it, alongside the existing stop and reset counters.
  Continuing reuses the existing continue request rather than adding a second
  one, so the toolbar, the keyboard and the new control cannot drift apart.
- **UI**: the run control over the editor, and its styling for the paused and
  running states.
- **Not affected**: the keyboard shortcuts, whose Continue already covers every
  machine that can now be paused. And the `Dialect` / `MachineEmulator` seam
  gains nothing — a
  pause is the pane declining to advance the machine, not a new thing a machine
  must implement. The desktop toolbar, the standalone player, and the Stop,
  Step and Run actions are all unchanged.

## Non-goals

- No pause control on the desktop toolbar, and no new place for the existing
  one — this is the button over the editor, where it already is.
- No change to what Run, Stop or Step do, and none to the toolbar's Play, which
  goes on starting a run from the beginning.
- No second word for carrying a paused run on: "Resume" is not introduced
  alongside "Continue".
- A pause is not a save-state. Nothing is serialised, nothing survives a Stop
  or a reload, and a paused run cannot be exported or shared.
- No pausing of the standalone player, which has no such control.
