## Context

The host already projects a held machine's display to something that can show a
web page. `src/server/view/` is that projection: a listener bound on loopback
only while a caller has asked for one, admitted by an unguessable address,
carrying sampled frames to a standalone page over Server-Sent Events. The
arrangement it spans — a machine that may be in this thread or in a worker of
its own, a listener always on the host's thread — is `src/server/view/link.ts`,
and `docs/contributing/architecture.md` has the map.

Two properties of that projection are the reason it cannot be widened into this
one. It is **read-only in the direction that matters**: `link.ts` states there is
no path from a viewer back to the machine, and that is what lets a machine be
watched without being shared. And it **spends none of the machine's frames**:
`src/dialects/headless/frameTap.ts` samples a fraction of them and subtracts its
own cost, so that being watched changes no measurement. A played machine
inverts both. Keys travel toward the machine, and the machine runs continuously
whether or not anything has asked it to.

Nothing here reaches past the `Dialect` / `MachineEmulator` seam. What playing
needs — advancing a frame, painting one, pressing an opaque key token, and
asking what rate the machine runs at — the seam already offers, because the
browser IDE has always driven machines exactly this way.

## Goals / Non-Goals

**Goals:**

- A held machine can be driven live by whoever holds a play channel's address,
  at the machine's own rate, from anything that shows a web page.
- The exception a played machine is to the "advances only when asked" rule is
  written down and bounded, rather than quietly weakening guarantees that other
  capabilities rest on.
- The network posture the view established — loopback only, nothing bound until
  asked for, unguessable address, no referrer, `Host` checked — is reused rather
  than reinvented, and the larger claim a play address makes is stated.
- An application embedding the toolchain can hold a machine of its own without
  reaching through the command line's shared session.

**Non-Goals:**

- Sound, a shared or multi-player machine, playing from another computer,
  recording a session, and any change to how a machine is emulated. The proposal
  lists these; none is revisited here.
- Changing the `Dialect` / `MachineEmulator` seam. No member is added, removed
  or altered, and no machine gains machine-specific code for this.
- Making the view interactive. `display-view` keeps every guarantee it has.

## Decisions

### Playing is exclusive, and says so

**Decision.** A machine is either being driven by requests or being played,
never both. While a play channel is open on a caller's machine, that caller's
requests which act on it or measure it are refused, naming the reason and how to
stop playing. Requests that only read it — the screen as text, the screen as a
picture — are answered, and are documented as sampling a machine that is moving.

**Why.** The invariant that a machine advances only when a request asks it to is
asserted in `toolchain-daemon`, `headless-cli` and `mcp-server`, and reproducible
measurement rests on it. Weakening it everywhere to accommodate playing would
cost every caller a guarantee for a feature almost none of them use. Confining
the exception to a machine that is explicitly being played leaves the rule
intact everywhere else, and makes the one place it does not hold impossible to
stumble into.

**Alternatives considered.** *Treat the play channel as one long-running request*
— tidy, and preserves the letter of the invariant, but it makes "how long did
that request take" meaningless and hides the exception behind a definition
rather than stating it. *Let every request through and let the caller cope* —
cheapest, but a profile taken across a played machine would return a number that
looks authoritative and is not, which is worse than a refusal.

### The clock lives beside the machine

**Decision.** The pacing loop that advances a played machine runs where the
machine runs — in its worker — not on the host's thread. It is self-correcting
against wall-clock time rather than a fixed interval, runs however many frames
are due, caps the catch-up so a stall cannot trigger an avalanche, and re-reads
the machine's rate every tick.

**Why.** The host's thread serves every caller's conversation; a pacing loop
there would jitter with unrelated I/O, and the machine would speed up and slow
down according to what someone else was asking. Re-reading the rate is not
optional: `MachineEmulator.frameHz` is documented as rarely a round number and,
on at least one machine, as derived from display registers a running program can
reprogram — so a loop that caches it plays some programs at the wrong speed.

**Alternatives considered.** *A fixed `setInterval` at 50Hz* — drifts, ignores
machines whose rate is not 50, and Node's timer granularity makes the error
visible within seconds. *Advancing from the frame-carriage side, one frame per
frame sent* — couples the machine's speed to the network and to whoever is
watching, which is precisely what the view was careful never to do.

### One duplex binary channel, not the view's arrangement widened

**Decision.** A play channel is a WebSocket: frames out as binary, keys in on the
same socket. The handshake and framing are implemented in the host against
`node:http`'s upgrade, adding no dependency; the page uses the browser's own
`WebSocket`. Frames are raw pixels compressed with raw deflate at a low level,
and a frame is dropped rather than queued when the far end is behind — the
back-pressure `src/server/view/feed.ts` already models.

**Why.** The view's carriage is Server-Sent Events, which is text: every frame
would pay base64 on top of compression, at fifty frames a second rather than
ten. Keys would need a second path, and a request-per-key can arrive out of
order relative to the frames it caused. One socket carrying bytes in both
directions is the simpler protocol even though the handshake has to be written.

Raw pixels rather than an encoded picture because `frameTap.ts` already records
what encoding every frame costs: at a fraction of the frames it warned that a
run would spend more time compressing pictures than emulating, and playing takes
all of them. Retro displays are blocky and largely unchanging between frames, so
raw deflate is cheap and compresses hard; identical frames are skipped entirely,
which is the common case at a `READY` prompt.

**Measured**, on the widest display among the registered machines (the BBC
Micro's 896x600 at 50Hz, so a frame budget of 19.97ms), over sixty frames idle
at the `READY` prompt and sixty with the screen scrolling:

| per frame          | idle              | scrolling         |
| ------------------ | ----------------- | ----------------- |
| raw pixels         | 2100 KiB          | 2100 KiB          |
| raw deflate (L1)   | 12.0 KiB / 1.30ms | 27.2 KiB / 1.35ms |
| PNG                | 4.4 KiB / 7.77ms  | 10.7 KiB / 6.13ms |
| painting the frame | 10.92ms           | 10.06ms           |
| comparing to the last frame | 0.25ms   | 0.27ms            |
| frames identical to the last | 53/60    | 59/60             |

Painting is the floor and is paid whatever the carriage. On top of it, raw
deflate spends 1.35ms of the remaining 9ms, and a PNG spends 7.8ms - which puts
the widest machine within a millisecond or two of missing its frame. Raw pixels
uncompressed are 105 MB/s at this size, which is not a thing to put on a socket
fifty times a second when a thirtieth of a millisecond of comparison and a
millisecond of deflate reduce it to under a megabyte a second. Comparing the
raw pixels costs a fifth of what deflating them does, so identical frames are
found by comparison rather than by compressing them and looking at the result -
and at a prompt that is seven frames in eight.

**Alternatives considered.** *Server-Sent Events plus a request per key* —
reuses the whole of the existing listener and adds no framing code, and remains
the fallback if the handshake proves troublesome; rejected on the base64 tax and
key ordering. *A WebSocket library* — the published toolchain has exactly one
runtime dependency and it is deliberate; a second would need a licence and
attribution pass to earn its place, for something that is a few hundred lines of
well-specified protocol. *A picture per frame* — the thing `frameTap.ts` exists
to avoid.

### Keys are the vocabulary that already exists

**Decision.** Keys reaching the machine are the opaque tokens
`MachineEmulator.setKey` already takes, named as the schedule grammar in
`src/app/driveScript.ts` names them. The page maps the browser's key codes onto
those names; the host never sees a browser event.

**Why.** `headless-cli` already guarantees that keys are named the same way on
every machine, and one grammar with one parser is what makes a schedule written
for one caller mean the same thing to another. A key pressed live and the same
key in a schedule must reach the machine as the same key, or a program checked
one way and played the other would behave differently for no reason the user
could see. The seam's other key entry point takes a real browser event, which
cannot cross a wire; `setKey` is what the virtual keyboard already uses, for the
same reason.

### A machine is projected one way or the other, never both

**Decision.** A machine has a view or a play channel, never both at once. Asking
for one while the other is open ends the other, and the caller is told that is
what happened.

**Why.** A view exists so that a machine being driven by requests can be watched
by someone who is not driving it. A played machine is already being seen by
whoever is driving it, so a second projection of the same display would double
what carrying it costs and serve nobody. Ending the other explicitly, and saying
so, is better than leaving a caller holding an address that has quietly stopped
answering.

**Alternatives considered.** *Allow both* — defensible, and it would let one
person play while another watches; rejected because the frame budget is already
the tightest constraint in this design and nothing has asked for that. *Refuse
the second request* — leaves the caller to work out which projection it already
had and end it by hand, for no benefit over doing it for them.

### The operations conversation gets what the other two have

**Decision.** The toolchain can serve its operations conversation over its own
standard streams, as it already serves the editor's and the agent's. The single
place that decides this today (`serveOverOwnStreams` in the command line's
entry, which is already limited to two of the three by nothing but its own
signature) admits the third; the argument parser and the usage text follow.

**Why.** The conversation is already modelled as first class and the host
already serves it — it has simply never been offered over streams, because the
only caller that spoke it was the command line, which reaches the host over the
socket. An embedding application needs a session of its own: the command line's
session is deliberately shared across all its connections so that a machine
survives between commands, so an application that shelled out would find itself
holding the same machine as the user's terminal.

**Alternatives considered.** *Speak the agent's protocol* — exists today and
needs nothing new, but an editor speaking it is off-key and it carries an
agent's framing for a caller that is not one. *Reach the socket directly* —
would put the host's addressing discipline into every embedding application,
which is the coupling the streams arrangement exists to avoid.

## Risks / Trade-offs

- **The exclusivity rule is discovered at the worst moment** → A caller that
  opens a play channel and then asks for a measurement gets a refusal it did not
  expect. Mitigated by refusing with the reason and the remedy rather than an
  error code, and by saying it in the operation's own description, so a caller
  reading what playing does learns what it costs before doing it.
- **The carriage cannot keep up on the largest displays** → The frame budget is
  the one number this design cannot derive from what exists. Prototype the
  carriage against the widest display among the registered machines before the
  spec's rate guarantee is written; if raw deflate at full rate does not hold,
  send only what changed rather than lowering the promise. The fallback to the
  view's existing arrangement stays available.
- **Hand-rolled protocol code is a security surface** → The handshake is
  well-specified and small, but it is new code accepting input from anything
  that reaches the port. Mitigated by keeping every check the view's listener
  already makes — loopback binding, `Host` verified, unguessable token — and by
  refusing anything that is not a well-formed upgrade rather than tolerating it.
- **A play address is a much larger claim than a view address** → The view's
  documentation says possession of the address is the whole of admission, and
  says it plainly *because a viewer can do nothing*. The same sentence about a
  play channel means someone can type at your machine. Mitigated by writing it
  as its own statement rather than a cross-reference, wherever playing is
  documented.
- **A stalled or wedged machine holds a clock** → A pacing loop that keeps
  asking a machine to advance while nothing responds burns a core. Mitigated by
  the catch-up cap, and by the channel ending with the caller that asked for it,
  as the view's does.
- **The seam is untouched, so nothing here can be blamed on a machine** → Stated
  as a trade-off rather than a risk: because playing uses only members the IDE
  already drives, a machine that plays badly is a machine that runs badly, and
  the fault is not in this change. That is deliberate, and it is why no
  machine-specific code is added.

### Full frames at the machine's own rate

**Decision.** A play channel carries whole frames at the machine's own rate.
Only what changed between frames is not sent, and the rate is stated as the
machine's own rather than as a floor beneath it. What keeps that affordable is
the two cheap steps either side of the deflate: a frame identical to the one
before it is not sent at all, found by comparing the raw pixels, and a frame
handed over while the far end is behind is dropped rather than queued.

**Why.** The table above is the whole argument: on the widest machine here,
painting and carrying a frame together spend about 12ms of a 20ms budget in the
worst case measured, and about 11ms in the common one. A delta encoding would
buy bytes that are not the constraint - under a megabyte a second is not what
runs out - at the cost of a decoder in the page, a keyframe rule, and a way to
recover a channel that has missed one.

**Alternatives considered.** *Only what changed between frames* - the fallback
the risk below names, kept available and unnecessary at these numbers. *A floor
beneath the machine's rate* - a weaker promise that the measurement does not
require, and one that would make a program's timing look like the carriage's
fault.

### The handshake is hand-rolled against `node:http`

**Decision confirmed.** The upgrade is taken from `node:http`'s own `upgrade`
event and answered in the host: the accept key is a SHA-1 over the client's key
and the protocol's fixed GUID, and the framing is the subset RFC 6455 requires
of a server - unmasked binary out, unmasked-refused masked frames in, close and
ping answered. The view's Server-Sent Events arrangement is not the fallback it
was left as.

**Why.** The framing is about two hundred lines against `node:crypto` and a
socket, all of it decided by the specification rather than by us, and every
check the view's listener makes is already written beside it. The alternative
carries a base64 tax on every frame and a second path for keys whose ordering
against the frames it causes is not defined anywhere.

## Open Questions

- Whether a played machine should be refused to a caller that cannot be told it
  is being played — an agent holding a machine that someone else's editor is
  playing is not a situation the session model can currently produce, but it is
  worth confirming that before relying on it.
