## Context

The run loop, the store's request-counter convention and the emulator pane's
place in them are described in `docs/contributing/architecture.md`; this
document assumes it rather than restating it.

Two facts about the current code shape everything below.

**A pause already exists, and it holds no state of its own.** The debugger's
breakpoint pause is `emulatorStatus === 'paused'` plus a frame loop that is not
scheduled. Nothing is serialised, nothing is copied aside: the machine, its
files and its audio graph simply stop being advanced. A user-driven pause is
the same thing reached by a different route, so this change adds a route, not a
mechanism.

**The paused state is already reachable and already handled.** Live memory
polling, the variable watcher and the run stopwatch all understand `'paused'`
today because the breakpoint pause produces it. What none of them have seen is
`'paused'` without a BASIC line attached, which is the one genuinely new
condition here.

The control being changed is the round Run button over the editor on the tabbed
touch layout. It is rendered only inside that layout's media query, and it
currently calls the run request unconditionally.

## Goals / Non-Goals

**Goals:**

- One control over the editor that shows which of the three run states the
  machine is in and drives the transition out of it.
- A pause that works on every registered machine, not only those with a
  line-level debugger.
- One action, with one name, for carrying a paused run on — whether the pause
  came from a breakpoint or from the user.
- No new obligation on machines: the pause is implemented entirely above the
  machine boundary.

**Non-Goals:**

- Any change to the desktop toolbar, the standalone player, or the Run, Stop
  and Step actions.
- Persisting a pause across a stop or a reload.
- Moving the control, or showing it outside the touch layout.

## Decisions

### The `Dialect` / `MachineEmulator` seam is untouched

No machine gains a method. Pausing is the emulator pane declining to call the
machine's frame-advance or debug-step function until asked to carry on, so a
machine cannot be "wrong" about pausing and a new dialect inherits the
behaviour without writing anything. This is why the pause can be offered on
machines with no debugger, where nothing else about stepping is available.

*Alternative considered:* a `pause()`/`resume()` pair on `MachineEmulator`.
Rejected — it would put identical do-nothing implementations in every machine
and invite them to diverge, to buy nothing the loop cannot already do.

### One new request counter for pausing; continuing reuses the existing one

The store gains a pause request counter and its action, following the
bump-a-counter convention used by stop and reset.

Continuing does **not** get a counter of its own. The work needed to carry on
from a user's pause is what the existing continue request already does, and the
name is the same word the toolbar and the keyboard already use. Two counters
would be two effects obliged to stay identical forever, and would let the
toolbar's Continue, its shortcut and the new control drift apart while all
three claimed to do the same thing. One request keeps them one action by
construction.

*Alternative considered:* a single toggle counter that means "pause if running,
continue if paused". Rejected — a toggle cannot tell a deliberate second press
from a double-tap, and a double-tap on a phone is the expected input. Distinct
requests, each guarded by the status it requires — pause acts only on a running
machine, continue only on a paused one — make the second tap a provable no-op.

### Continue serves both pauses, decided by the machine's own state

The continue effect's guard changes from "a debug session is active" to "a
machine exists and the run is paused". With a debug session armed, continuing
carries the machine on in its run-to-breakpoint mode, so it stops at the next
breakpoint; with no session, it carries on advancing frames freely. The user's
one word gets the machine's own semantics without the UI having to know which
kind of pause it is looking at.

The new guard is strictly safer than the one it replaces: it also refuses a
continue while a run is already running, where the old guard would have
re-entered the loop. Step keeps its debug-session guard, because stepping
without a stepper is meaningless.

### A user's pause is deliberately not a breakpoint pause

The breakpoint pause reports the BASIC line it stopped before, publishes the
pause interval the profiler charges, and brings the mobile layout to the editor
tab so the highlighted line can be seen. A user's pause does none of these:
execution stopped between frames, so there is no line to report; the profiler's
reading is only meaningful alongside one; and the user is already on the editor
tab, because that is where the control is.

### Pausing is refused in three situations

Each would strand something that has no other way out:

- **A run the IDE started to check an assistant's answer.** The verdict is
  reached by the frame loop; a paused loop never reaches it, so the assistant
  would wait forever.
- **The assistant driving the machine directly.** It advances the machine
  outside this loop, so a "paused" machine would visibly keep moving.
- **Before the first frame is drawn.** The loading overlay is dismissed by the
  first rendered frame; pausing in that window leaves it up permanently.

### The state derivation lives in a pure module, not in the component

Unit tests here run in a node environment with no React renderer, so the
mapping from run status to control state, glyph and label — and the check for
whether pausing is allowed — go in a small pure module beside the store, which
the component reads. This follows the existing split used for the input overlay
mode. The mapping is written as a total record over the run status type, so a
fourth status cannot silently fall through to a default.

### Glyph and colour

The glyph stays text, matching the toolbar's existing set: the play triangle
for both play and continue — the toolbar's own Continue already uses it, and a
continue is a play — and a double-bar for pause, chosen in its
text-presentation form so no emoji rendering has to be fought. Running and
paused share the app's single blue accent, so the button reads as "green means
it is not running" at a glance; the contrast pairing follows the green state's
dark-ink treatment rather than white, which only just clears the large-text
threshold on that blue.

### The control gets a test hook, not a role name, for the e2e

The control carries a state attribute and a test id. This matters beyond
convenience: Playwright's accessible-name matching is a case-insensitive
substring match, and existing specs click buttons named "Play" and "Continue"
meaning the toolbar's. The toolbar's run controls and this one are hidden by
opposite halves of the same breakpoint, so those two never collide — but the
touch layout's overflow menu carries its own Play, Step and Continue, and while
it is open they and the control are both in the tree. Addressing the control by
test id sidesteps that, and survives the labels being reworded.

### The Continue shortcut is widened

On machines with no line-level debugger the control is the only way to continue,
and it disappears above the touch layout's breakpoint — pause on a phone, rotate
or widen, and only Stop remains. So the Continue shortcut's availability changes
from "the machine has a debugger" to "the run is paused". The Step shortcut
keeps its debugger condition.

## Risks / Trade-offs

- **A pause with no BASIC line reaches code written for the breakpoint pause** →
  the paused-line report is left unset rather than set to a placeholder, so the
  editor marks no line and the profiler's per-line reading is simply absent,
  which is what both already do between breakpoints.
- **Sound at the moment of pausing** → the audio graph is left alone; its worklet
  emits silence when it runs out of frames, after the fraction of a second of
  buffer already queued. Tearing down and rebuilding the graph per pause would
  cost more than that tail.
- **A user pauses expecting the program to be safe, then reloads** → a pause is
  not a save-state and is not claimed to be one; a stop or a reload ends the run
  as it does today.
- **A machine that cannot be stepped is now pausable, so a user can reach a
  state the toolbar has no button for** → mitigated by widening the Continue
  shortcut, so the state is escapable without the touch control.
