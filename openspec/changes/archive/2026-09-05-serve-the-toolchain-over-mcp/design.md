# Design

## Context

The operation layer, the machine session and the seams this builds on are
described in `docs/contributing/architecture.md`; this states only what is
decided here.

**No impact on the `Dialect` / `MachineEmulator` seam.** Nothing here reaches a
machine except through the interfaces that already exist, and no dialect gains,
loses or changes a member.

## Goals

- A third caller that needs no reshaping of the operation layer.
- A machine held across requests, without disturbing how the command line runs a
  program today.

## Non-Goals

Listed in the proposal.

## Decisions

### The server is a caller, not the assistant's tools over a wire

Re-serving the assistant's tool set would arrive broken. Both absences on record
are the assistant's, and neither reason reaches this caller:

| Operation | Absent from | Why that reason does not hold here |
| --------- | ----------- | ---------------------------------- |
| `run` | the assistant | Its absence is because the IDE runs the assistant's program on the user's own machine, and the assistant is then given that machine. There is no IDE here and no machine of the user's to check an answer against, and this caller boots one exactly as the command line does. |
| `check` | the assistant | The same reason, for the same machine: a second path would reach a verdict about a machine that is not the user's. Again there is no such machine here. |

An absence is a fact about one caller's circumstances, not about the operation,
so it does not travel. Serving only what the assistant is offered would hand an
agent the operations that act on a machine and none that can start one.

`screenshot` moves the other way. It is offered to the assistant as part of an
answer rather than as a tool, because a tool's answer is text and a picture is
not. A result here carries a picture as a picture, so this caller serves one
better than either existing caller does.

This caller therefore carries no exemptions. Because the table is checked in
both directions, that emptiness is itself the assertion that nothing is missing:
a later operation this caller cannot serve has to say why.

### The assistant's tool definitions are not reused

What the assistant is offered must be identical on every turn of a conversation,
because it is what the cached prefix is anchored to. That constraint belongs to
the assistant's circumstances, not to this caller's. Rendering both surfaces
through one function would let an addition here silently cost the assistant its
caching, so each caller renders its own surface from the one declaration —
exactly as the command line already does.

### A held machine needs no new lifecycle

The one-shot run is built from primitives that already boot, load and dispose
independently, and disposal is already the caller's responsibility rather than
the runner's. Holding a machine is therefore a matter of not disposing it yet,
not of taking the existing runner apart. The one-shot run is left exactly as it
is, which is what keeps this change off the command line's path entirely.

Two constraints follow from how a machine is stood up outside a browser:

- The stand-ins a headless machine needs are installed for the whole process, so
  one machine is held at a time and a second request to boot is answered rather
  than quietly nesting a second set of them, which would restore in the wrong
  order.
- Some machines finish loading a program on a later turn of the event loop, so a
  program is not considered loaded until that has had its chance. A server that
  answered before it landed would report an empty screen for those machines
  only.

### Frames are spent by requests, not by a clock

Nothing advances the machine between requests. An action spends the frames it
needs; looking at the screen spends none. This is how a schedule on the command
line already behaves, and it keeps every measurement in the machine's own
emulated time rather than in how long an agent took to think. A program waiting
at a prompt simply waits.

## Risks / Trade-offs

- **A new dependency.** Speaking the protocol by hand is possible, but this is
  the same argument already settled for the language server, whose protocol
  library is a runtime dependency under a compatible licence. Record the licence
  check the project requires, and confirm the library survives bundling first
  rather than last — the language server's did not, without help.
- **One machine at a time** may surprise an agent working on two programs. What
  happens is stated rather than guessed at; lifting the limit means reworking
  the process-wide stand-ins, which is not worth doing before anyone wants it.
- **A held machine is state an agent can leave behind.** The server lets it go
  on disconnect, so a client that stops without saying so strands nothing.
- **A published surface is harder to change than an internal one.** The
  operations, their inputs and their names are the declaration's, not this
  server's, so what is published moves only when the declaration does.

## Migration Plan

Independently green steps: the third caller declared and the parity check
extended, with no server yet; then the held machine; then the surface and the
transport over it. Nothing existing changes behaviour at any step.

## Open Questions

- Whether replacing the held machine or refusing the second request is the
  better answer when an agent runs a second program. Both are defensible; what
  matters is that it is the same answer every time and that it is stated.
