## Why

A held machine can now be watched from another application, but it cannot be
used. A person supervising an agent, or an application that embeds the toolchain
and shows the machine in a frame of its own, sees the screen and can do nothing
to it — every keystroke has to go back through whoever holds the machine, one
request at a time, and the picture arrives too slowly and too seldom to play
anything on.

That is felt hardest in an editor. Someone writing a listing has the whole
language behind them — problems, completion, hover, colour — and no way to run
what they have written without leaving for a terminal or a browser. The machine
is a request away and still out of reach.

## What Changes

- **A caller holding a machine can ask for it to be played, not only watched.**
  It is given an address; anything that can show a web page can show what is
  there, and whoever is shown it can type at the machine and see it answer at
  the machine's own rate.
- **A machine being played runs on its own clock.** This is the one exception to
  the rule that a machine advances only when a request asks it to, and it is
  stated rather than left to be discovered: while a machine is being played it
  is being driven by a person, so it is not a machine anything can measure. What
  a request answers about a played machine, and what becomes of a measurement
  taken across one, are said plainly.
- **Playing and watching stay different things.** A view mirrors and never
  drives; a play channel drives. Both are projections of a held machine, both
  are asked for by the caller holding it, and what happens when one machine is
  asked for both is settled rather than incidental.
- **The operations conversation can be spoken over standard streams.** The host
  already serves that conversation, and an editor or an application already
  starts the toolchain over its own streams to speak the other two. Offering the
  third the same way is what lets an embedding application hold a machine of its
  own, rather than reaching through the command line's single shared one and
  fighting whoever else is using it.
- **Playing is an operation**, so the command line reaches it on the same terms
  as everything else. It is deliberately not offered to an agent or to the
  assistant, and the reason is recorded rather than the absence being left to
  look like an oversight: neither can type at a machine as it runs, and both
  already have a way to drive one.
- No existing behaviour changes and nothing is removed. A machine nobody has
  asked to play behaves exactly as it does today. **Not breaking.**

## Non-goals

- **Sound.** A played machine is seen and not heard. Machines that synthesise
  audio go on doing so for their own sake; carrying it to whoever is playing is
  later work.
- **Making a view interactive.** `display-view` keeps every guarantee it has,
  including that a viewer can do nothing. Anything that drives a machine is a
  play channel, not a view.
- **Playing from another computer.** A play channel is reachable from the
  computer the host runs on, exactly as a view is.
- **More than one person at a machine.** A machine is played by whoever holds
  its address, and the arrangement is not a shared one.
- **Recording, replaying or rewinding a session.** Playing is live and leaves
  nothing behind.
- **Any change to how a machine is emulated.** Every machine plays as the
  machine it already is.

## Capabilities

### New Capabilities

- `machine-play`: Driving a held machine live from something that can show a web
  page — what a caller must do to obtain a play channel, what whoever is given
  one may and may not do, how the machine runs while it is being played and what
  that costs the guarantees that assume it is not, who is admitted, and when the
  channel ends.

### Modified Capabilities

- `toolchain-daemon`: The host serves a second kind of projection beside the
  view it serves today, and the requirement about what a caller's machine does
  between requests gains the exception a played machine is.
- `display-view`: Says what a view is not, now that something else is. What
  happens when the caller holding a machine asks for both a view and a play
  channel is settled, and the security note about possession of an address is
  drawn so that a reader does not carry a view's terms across to a play
  channel's.
- `headless-cli`: The command line can ask for a machine to be played, and can
  serve the operations conversation over its standard streams as it already
  serves the other two. Its guarantee that a held machine advances only when a
  command asks it to gains the same exception.

`mcp-server` is deliberately absent from this list. Its guarantee that every
operation is offered to an agent already provides for an operation that
deliberately is not, declared together with its reason — so recording why an
agent is not offered playing is the mechanism working, not a change to it.

## Impact

- **The operations layer** gains one operation, declared once and derived by the
  callers that offer it, with its absence from the other callers declared beside
  it. The parity check that holds every surface to the operation list is what
  proves the exemption is a decision rather than a gap.
- **The host** gains a second thing it can project, sharing the listener,
  the admission and the network posture the view already established, and gains
  a clock: something has to advance a played machine, which nothing in the host
  has ever had to do.
- **The command line** gains an operation and a way of serving that it already
  has the shape for.
- **What a machine costs to carry** is the open question this change has to
  answer: a view samples a fraction of the frames and can afford to encode them
  as pictures, and a played machine can do neither. Nothing about how a machine
  is emulated changes; how its display reaches whoever is playing it is new
  work, and `design.md` settles it.
- **The documentation** gains a page for playing beside the one for watching,
  and must state plainly — as the view's does — exactly what an address protects
  and what it does not, which for a play channel is a larger claim.
- No new dependency is expected. Anything the carriage turns out to need is a
  licence and attribution question before it is a technical one.
