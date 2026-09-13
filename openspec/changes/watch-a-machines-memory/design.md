## Context

Three arrangements already exist that this sits between, and
`docs/contributing/architecture.md` describes each - §"The projections" for what
the host serves and on what terms, §"One operation layer, every caller" for how
an operation reaches the command line and an agent at once.

What is new is only the third projection and the tap that feeds it. Everything
it rests on is in place: the per-machine layout tables and the memory-activity
seam on the emulator, the projection host with its listener and its tokens, the
WebSocket the play channel already speaks, and the per-frame fold the display's
sampling already hangs off.

**The `Dialect` / `MachineEmulator` seam does not change.** Recording and
draining memory activity are already declared on it, already owed by every
machine with a bus to tap, and already held to behaviourally by a
registry-driven test that names its exceptions with reasons. No member is added,
none changes shape, and no machine implementation is touched. That the seam is
untouched is the reason this is a change to the host rather than to the
dialects.

## Goals / Non-Goals

**Goals:**

- A held machine's memory layout and live activity reachable at an address that
  can be framed, on the same terms the other two projections are admitted.
- A map that can be open while the machine is being played, because that is the
  only circumstance in which a held machine advances of its own accord.
- A tap that costs a machine nothing when nobody is watching and changes no
  measurement when somebody is.
- One declaration, so the command line and an agent gain it together.

**Non-Goals:**

- Reading or writing the byte at an address (see the proposal's Non-goals).
- Sharing rendering code with the IDE's panel.
- Any change to what a view or a play channel is, or to the rule that a machine
  has one or the other of them.

## Decisions

### A third projection, outside the arbiter rather than inside it

A view and a play channel are two ways of showing one screen, and the host keeps
them mutually exclusive: asking for either ends the other, and the outcome says
so. `display-view` gives the reason in its own words - a view exists so that a
machine driven by requests can be watched, and a played machine is already being
seen by whoever is driving it.

That reason is about the display. A map shows what neither of them shows, so it
is not a third arm of the same choice: it may be open beside either, and opening
it ends neither.

This is load-bearing twice over. Behaviourally, a held machine advances unasked
only while it is being played, so a map that ended the play channel would show a
still picture of a stopped machine - the one thing it must not do. Structurally,
the mutual exclusion is written as a pair (each `open` ending the other and
reporting that it did), not as an arbiter over a set; a third member would have
to rewrite it. Standing outside it means the pair is left exactly as it is.

**Alternative considered:** a pane on the play channel's page, so the map
arrives in the frame an embedder already has. Rejected: what a play channel's
address admits is stated as the machine's keyboard and screen and nothing else,
and that is a claim about the address, not a layout decision. Widening it would
mean whoever was handed a play address to type at was also handed a picture of
the machine's memory.

### Data across the wire, not pixels

The display is projected as pictures because a screen is one. A memory map is a
picture whose reader wants to zoom it, resolve it into finer regions, switch how
its addresses are written and ask what a region is - all of which are questions
for whatever is showing it. So what crosses is the layout once and the activity
repeatedly, and the drawing happens at the far end.

**Alternative considered:** render the map beside the machine and project it as
sampled pictures, reusing the display's whole carriage unchanged. Rejected: it
would make the projected map strictly less than the one the IDE draws, and the
saving is in the one place there is no pressure - the layout is sent once.

### Reduced beside the machine, before it crosses anything

The activity a machine records is one byte per address of its whole address
space, and the machine is on a thread of its own. Handing that across per frame
is the same order of traffic as an uncompressed picture, which is why the play
channel compresses before crossing rather than after.

So the reduction happens where the drain happens: the touched addresses are
grouped as coarsely as the picture can distinguish, and the result compressed,
before it is handed over. What crosses is a small fraction of what was drained,
and the thread boundary needs no new capability to carry it.

**Alternative considered:** hand the raw buffer over and reduce on the host's
thread. Rejected: it moves the same bytes and then does the work on the thread
that serves every other caller.

### A dropped sample merges rather than vanishes

The display's tap samples every Nth frame and drops a sample whose predecessor
is still in flight, because a picture is a moment and a stale one is a backlog.
Memory activity is not a moment: what a machine records is everything touched
since it was last drained, so a drain that is skipped widens the next drain's
window rather than losing anything.

That makes this tap simpler than the one it sits beside, and it is worth saying
plainly, because the two look alike and one of them has a problem the other does
not. Sampling here is a rate control and nothing more.

### One place the tap hangs, covering every way a machine advances

There is already a single per-frame step every path folds through - the played
machine's clock reaches it by asking the machine to advance, and so do running,
stepping and continuing. The display's sampling hangs there. The activity tap
hangs in the same place, and thereby covers a machine being played, run, stepped
and continued without a second path or a second decision about when it fires.

Arming follows whether anything is watching, as the display's does, so a machine
nobody is mapping records nothing. What the tap costs the host is accumulated
and taken back out of the run's reported time, for the same reason the display's
is: otherwise every watched run would measure slower than the same run
unwatched. And a settle after each request, so the map shows what the request
that just ran did, rather than whatever the last sample happened to catch.

### The page is hand-written and standalone

Both existing projection pages say the same thing about themselves: no
framework, no build step of their own, nothing from the IDE. The host's own
account of them argues that the duplication is deliberate, because what an
address admits is a different claim in each and each page states its own. A page
that pulled the IDE's renderer into the host's bundle would contradict that, and
would put the browser application's modules inside the published toolchain.

So the page draws for itself. What is worth not writing twice is not the
drawing but the rule for which regions collapse into which bands - a pure
transform over the layout table, with nothing of the browser in it. That is
computed beside the machine and sent with the layout, so the page receives bands
ready to draw. Where that transform lives has to move: it sits among the IDE's
components today, and the host may not reach in there. It belongs somewhere both
may import.

**Alternative considered:** build the IDE's renderer as a second, browser-target
bundle and inline it in the page. Rejected for the reason above; recorded here
because it is the obvious idea and its rejection is not obvious.

### Two ways a machine declines, answered as two

A machine whose layout the toolchain does not describe has no map to show. A
machine with a layout but no bus to tap has a map that will never light up.
These are different facts and a caller can act on the difference, so they are
answered differently rather than collapsed into an empty picture.

This is the same argument the registry-driven test over the activity seam
already makes about silent degradation: a machine that cannot say must look
different from a program that touched nothing.

## Risks / Trade-offs

- **The map is only as live as the machine is moving.** Between requests a held
  machine does not advance, so a map of one shows the last thing it did. →
  Stated as a guarantee rather than hidden: the map says what it is showing, the
  way a view already says whether it is idle, working or has no machine.

- **A third kind of thing to serve touches the listener in many small places** -
  its routing, its token set, its teardown, and the thread-boundary vocabulary.
  → The places are known and each is small; and because the map stands outside
  the view/play exclusion, the one piece of that machinery that would have had
  to be redesigned is untouched.

- **Traffic while a machine is played.** Activity is sent as often as the
  machine paints, beside the pictures the play channel is already sending. →
  Reduced before it crosses the thread boundary, compressed, and dropped rather
  than queued when the far end is behind - the same back-pressure discipline the
  display's frames already have.

- **A page nobody can see is still a page that must not leak.** → It is admitted
  exactly as the other two are, is served no route that accepts anything from
  whoever holds it, and never learns its own address.

- **Recording is a branch on the machine's memory path.** Arming it while
  something watches costs the host a little. → It costs the *machine* nothing
  that it counts: the emulated time a program takes is the same either way, and
  the host's cost is accounted and subtracted like the display's.

## Open Questions

- Whether the projection's guarantees belong in a capability of their own or as
  requirements on the one that governs the map itself. Taken as its own here,
  because the view and the play channel each have theirs and because what is
  being stated - how an address admits, how long it lives, that whoever holds it
  is not a caller - is about projecting rather than about memory. Worth
  revisiting if a fourth projection ever makes the three look like one thing
  said three times.
