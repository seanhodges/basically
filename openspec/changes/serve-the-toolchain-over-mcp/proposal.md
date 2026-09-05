# Serve the toolchain over MCP

## Why

The toolchain outside the browser is already reachable by an agent, but only as
one-shot invocations. An agent working on a BASIC program must write its whole
schedule of keypresses blind, up front, get one screen back, and start again
from a cold boot to try anything else. The IDE's own assistant does not work
that way: it is handed a machine that is already up, and drives it a step at a
time, looking between actions and correcting course.

That difference is not a property of the assistant. It is a property of holding
a machine. A server that stays up between requests can offer any agent the loop
the assistant already has.

`share-one-interface-across-callers` built the layer this needs and left the
door open deliberately: "The declaration is shaped so one could be added without
a second reshaping, and nothing here adds one." This adds one.

## What Changes

- A new operation serves the toolchain over the Model Context Protocol, holding
  its streams open until the client disconnects, in the same way the language
  server already does for an editor.
- The server offers every operation the toolchain declares. It is the first
  caller that needs no declared absence: it can boot a machine, as the command
  line can, and it holds one between requests, as the assistant does. Both
  absences on record are the assistant's, and both are because the IDE runs the
  assistant's program on the user's own machine — a reason that does not reach a
  caller with no IDE behind it.
- A machine stays up across requests. An agent boots once and then acts, looks,
  measures and checks against the machine its earlier requests left.
- A picture of the screen is served as a picture rather than described, which
  neither existing caller can do.
- Caller parity stops being a two-caller guarantee and becomes a guarantee over
  every caller of the toolchain.

## Non-goals

- **Serving over anything but standard streams.** No socket, no HTTP. The
  language server settled this for the same reasons and this follows it.
- **The assistant consuming other servers.** This exposes the toolchain; it does
  not teach the IDE's assistant to reach outward. That is a different change.
- **Holding more than one machine at a time.** A second is answered plainly
  rather than quietly.
- **Reaching a program by path.** A program arrives as text, which is what the
  operations already take.
- **Changing what any existing caller does.** The command line and the assistant
  behave exactly as before.

## Capabilities

### New Capabilities

- `mcp-server` — serving the toolchain to an agent over the protocol, with a
  machine held between requests.

### Modified Capabilities

- `headless-cli` — the parity requirement is widened from the command line and
  the assistant to every caller of the toolchain, and renamed to match.

`ai-assistant` needs no change: its parity requirement is already written over
"any other caller of this toolchain".

## Impact

An agent outside the browser can work on a BASIC program the way the IDE's
assistant does — boot, look, act, look again — instead of guessing a schedule
and reading one screen. The parity guarantee that keeps the callers honest now
covers three of them, and because absences are checked in both directions, a
later operation that cannot be served here has to say why.
