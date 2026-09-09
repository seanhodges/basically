## Context

`docs/contributing/architecture.md` §"The toolchain outside the browser"
describes what this change extends: a host that keeps running and holds a
machine, a thin client, and three conversations — the command line's operations,
an editor's language server, an agent's protocol — multiplexed over one socket by
a `hello` handshake. Read it first; this document says only what is added.

Four facts about the code as it stands shape every decision below.

- **The picture already exists, headlessly and without a browser.**
  `HeadlessCanvas` and a hand-rolled `encodePng` over `node:zlib`
  (`src/dialects/headless/headlessCanvas.ts`) already paint any registered
  machine and encode the result; `screenshot` and the agent's image content block
  are both fed from them. Nothing new is needed to obtain a frame.
- **A held machine already exposes a read that spends no frames.**
  `createHeadlessSession().capture()` (`src/ops/headlessSession.ts`) paints and
  encodes without advancing the machine, which is exactly the mirror semantics
  this change specifies.
- **The operations layer cannot own a socket.** `eslint.config.js` forbids
  `src/ops/**` from importing any node builtin. Everything an operation needs
  arrives through `OpContext` (`src/ops/types.ts`), which already carries `roms`,
  `runner` and `painting` on exactly these terms.
- **The host's access control is filesystem ownership.** `src/server/address.ts`
  derives — never records — a Unix socket or named pipe path from platform, user
  and build id, under a 0700 directory. There is no HTTP server anywhere in the
  tree, and no port is bound by anything.

The binding constraint is the last one. A web view cannot open a Unix socket, so
a projection must be reachable at an ordinary address, and the protection the
whole design rests on does not extend to it. The proposal's argument — that the
guarantee is about *callers*, and a viewer is not one — is what makes this
admissible, and `specs/toolchain-daemon/spec.md` makes it explicit rather than
leaving it to be read that way.

**Impact on the `Dialect` / `MachineEmulator` seam: none.** Nothing here reaches
below `src/ops/` and `src/server/`. No dialect, no emulator, no bus and no seam
member is touched; the picture a viewer sees is the picture `screenshot` returns
today, taken on the same code path.

## Goals / Non-Goals

**Goals:**

- A held machine's display, showable in a frame by an application that embeds the
  toolchain, without that application understanding how the picture is carried.
- Mirror semantics preserved exactly: the machine advances only when a request
  asks, and being watched changes no answer.
- A viewer that is structurally incapable of acting, so "a machine belongs to one
  caller" needs no weakening.
- No new runtime dependency, and no port bound unless a view was asked for.

**Non-Goals:**

- Input, sound, recording, remote access, and multiple callers on one machine —
  see the proposal's non-goals.
- Changing any operation's answer, the browser IDE, or the assistant.
- Making the view survive the host that projects it.

## Decisions

### 1. The view is a projection of a session, not a fourth conversation

The obvious reading — "a fourth thing beside ops, lsp and mcp" — is wrong in one
important way. The other three are conversations a *caller* opens, each getting a
`HostSession` and, lazily, a machine of its own (`src/server/sessions.ts`). A
viewer must get none of that: no session, no machine, no operation dispatch.

So the projection hangs off an existing session rather than creating one. A
caller asks its own session for a view; the host opens a listener bound to that
session and hands back an address. `sessions.ts`'s "what one caller does to its
machine is invisible to every other" survives untouched, because the viewer never
becomes a caller to be invisible to.

This is also why read-only is not a limitation being tolerated but the property
the design is built on. Adding input later is exactly the moment this decision,
and that invariant, must be reopened.

_Alternative considered:_ a `view` conversation on the existing socket, with the
embedding application proxying it. Rejected: it pushes the whole problem onto
every embedder, and an embedder that got it wrong would be proxying a channel
that *can* act on the machine.

### 2. The contract is a served page, not a wire format

The host serves a small standalone page; what runs inside it is private and may
change. The third party's contract is "a URL you put in a frame".

This mirrors the one existing iframe integration in the repo — `DocsDrawer`
hosting `/docs/` and talking to it over `postMessage`, with message types pinned
by string because, as `src/components/DocsDrawer.test.ts` puts it, nothing
typechecks across an iframe.

_Alternative considered:_ a raw `multipart/x-mixed-replace` MJPEG endpoint the
embedder points an `<img>` at. Genuinely tempting — zero client code, works in the
crudest web view, and feeds a video pipeline too. Rejected because it fixes the
wire format permanently at the moment of publication, can never carry sound or a
state signal, and offers no path to input. A served page keeps all of those open
without asking the embedder for anything more today.

### 3. Server-Sent Events carrying encoded frames, over `node:http`

Both are builtins, so this adds **no dependency**. `EventSource` is native in
every web view. The dependency policy here is tight and enforced —
`src/client/thinness.test.ts` caps the client's module count and denies a named
list of packages, and every new dependency needs a GPL-3.0 compatibility check —
so avoiding one entirely is worth a great deal.

Mirror semantics make SSE an unusually good fit: the stream is silent whenever
the machine is idle, which is most of the time, and a one-way push is all a
read-only viewer needs.

_Alternatives considered:_ a WebSocket (a dependency, or a hand-rolled frame
codec, for a duplex channel nothing yet uses); H.264 or fragmented MP4 in a
`<video>` element (an encoder dependency, and H.264's patent position against
GPL-3.0 is not a fight worth having for a 256×192 screen); WebRTC (a media stack
for a same-computer problem). SSE upgrades to a WebSocket later without the
embedder noticing, because of decision 2.

### 4. Frames are pushed when the machine moves, never on a clock

There is no pacing loop, and `frameHz` is not consulted. The machine advances
only inside a call, so the view emits when a call advances it and is silent
otherwise.

Within a call that advances many frames — `MAX_DRIVE_FRAMES` is 1000, twenty
seconds of machine time — the view samples every _N_ th frame. The seam is
`RunObserver.frame?(machine)` (`src/dialects/headless/runTypes.ts`), already used
by `src/ops/run.ts` to fold measurements against a live machine, and called from
`runFrame()` in both runner implementations.

Sampling coalesces: if a frame is still being encoded when the next sample is
due, the sample is dropped rather than queued. This is what the spec's "shows the
most recent picture rather than an accumulating backlog" requires, and it also
bounds the cost of watching a fast machine.

### 5. The cost of watching is measured and excluded, because the tap is inside the timed window

This is the trap in the change, and it is not obvious. In
`src/dialects/headless/runListing.ts` the observer fires inside `runFrame()`,
which sits inside the window that becomes `timings.runMs`. A frame tap that
painted and encoded would silently inflate every run's reported time — a
measurement tool quietly lying because someone was watching it.

Two things follow, and both are load-bearing:

- **Machine-time measurements are safe by construction.** `profile`, `time` and
  `variables` are counted in the machine's own frames and cycles, and a view
  spends none. These are identical whether watched or not, and that is what the
  spec guarantees absolutely.
- **Host wall-clock time must have the view's cost subtracted.** The pattern
  already exists directly above: `renderMs` is accumulated inside the loop
  precisely so painting can be accounted for separately. The view's encode time
  is accumulated the same way and excluded from the reported run time.

A test that runs the same program watched and unwatched and compares is the only
way this stays true, and it is named in the tasks.

### 6. The address is an operation; the listener is not

`view` becomes an operation with `needs: 'session'`, returning the address as
JSON — which is what `src/ops/parity.test.ts` requires of every outcome, and why
returning an address rather than a stream is the only shape that fits.

The parity rules then do the work rather than being worked around:

- The check permits **zero** MCP exemptions, so `view` reaches an agent
  automatically — which is the case the change exists for.
- The command line gets `basically view` from the same declaration.
- The assistant takes a declared exemption. Its reason is particular to it, as
  `openspec/specs/headless-cli/spec.md` demands: the assistant runs in the
  browser, where the machine is already on the screen in front of the user and
  there is no host to project from.

The listener itself lives in `src/server/`, beside the language server and agent
server — which are likewise not operations, and for the same reason: they need
the network and filesystem that `src/ops/` is forbidden.

The address reaches the operation through `OpContext`, the way `painting` and
`roms` already do.

### 7. Admission is a capability address, and it is the only guard

Bound on the loopback interface, on an ephemeral port, only when a view is asked
for. Admission is possession of an unguessable path, generated per view and never
reused.

Everything else is defence against a specific, known attack rather than layered
protection:

- The `Host` header is checked, because a page anywhere on the internet can point
  a request at a loopback address (DNS rebinding).
- No cross-origin headers are sent.
- The referrer is suppressed, so framing the view does not leak its address to
  the embedder's own network.

What cannot be done is restrict who may frame it — third-party embedding is the
entire point. So the address really is the only thing protecting a view, and the
spec says so plainly rather than implying depth that is not there.

_Alternative considered:_ keeping the address in the URL fragment so it never
reaches the server, exchanged once for a cookie. Better against referrer leaks,
but it adds an exchange step and a cookie to a same-computer projection whose
address is already unguessable and short-lived. Not worth it; revisit if views
ever outlive a session.

### 8. The view follows the session, not the machine

A caller that runs a second program disposes the first machine. The view stays
with the caller and shows the new machine.

The alternative — a view bound to one machine, dying when it is replaced — would
mean an embedding application's frame going blank every time it ran a program,
which is precisely when its user most wants to be looking. The view is a window
onto a caller's workspace, not a handle on one machine, in the same way a browser
tab keeps its address when it loads a new page.

This is why the spec has the view report "no machine is up" as a state rather
than ending: the address stays valid across the gap.

### 9. The page is inlined at build time

`scripts/headless/build.mjs` already carries a `raw-imports` plugin
reimplementing Vite's `?raw`, so the page is a source file imported as text and
bundled. No asset directory, nothing to resolve at runtime, and one fewer thing
for an npm-installed toolchain to get wrong.

The page must not reach the IDE: `src/build/webBoundary.test.ts` guards the
converse direction, and this page is hand-written and standalone rather than
anything React.

## Risks / Trade-offs

- **The caller/viewer distinction is the whole argument, and a reviewer could
  reject it.** → It is stated in the proposal's first substantive claim and
  written into `toolchain-daemon` as amended requirement text, not left implicit.
  If it does not hold, the change should not proceed rather than be softened.
- **A frame tap silently inflating run timings** (decision 5) → the view's cost
  is accumulated and excluded, and a watched-versus-unwatched comparison test
  pins it.
- **The toolchain becomes installable from npm around the same time.** A package
  that can bind a port is a materially different posture from a checkout. → No
  port is bound unless a view is asked for, the listener dies with the session,
  and this change lands after the publishing one so the posture is documented
  from the start rather than changed under users.
- **A capability address in a URL is one mistake from leaking** — a screenshot, a
  pasted log, an embedder's referrer. → Per-view, never reused, dies with the
  session, referrer suppressed. It is also only ever reachable from the one
  computer, which bounds the damage sharply.
- **Encoding cost on a fast-changing machine** → sampling with drop-on-busy
  coalescing bounds it, and the machines are small: a two-colour 256×192 screen
  compresses to a few kilobytes.
- **A view is a long-lived connection, and the host's idle release counts
  connections** (`src/server/lifetime.ts`) → a view belongs to a session, not a
  connection, so a host whose callers have all gone still releases; the view goes
  with the session that owned it.
- **The worker boundary.** A caller's machine lives in a worker thread
  (`src/server/machineWorker.ts`) and frames must cross it to the listener on the
  main thread. → Frames are already JSON-safe encoded bytes, which is what
  everything else crossing that boundary is; the cost is a copy per sampled
  frame, which the sampling rate bounds.

## Migration Plan

Nothing to migrate: no stored data, no format, and no protocol anyone depends on
changes. Every existing conversation, launcher and configuration behaves
identically, and a host that is never asked for a view is byte-for-byte the host
that runs today.

Sequencing is the only constraint. `hold-a-machine-between-commands` must be
archived first, because this change modifies `toolchain-daemon`, which is not yet
a baseline capability. `publish-the-toolchain-to-npm` should land first too, so
that the posture change is documented in an installable artifact from the
beginning rather than introduced to existing installations.

Rollback is removal: nothing else depends on the operation, and a toolchain
without it is the toolchain as it stands.

## Open Questions

- **How often should a view sample within a long call?** Every _N_ th frame, but
  _N_ wants choosing against a real machine rather than guessed. Too coarse and
  an agent's keystroke is invisible; too fine and the encode dominates.
- **Should the view show anything about what the caller is doing** — the
  operation in flight, the schedule being driven — or only the screen? The screen
  alone is the safe starting point, and anything more leaks the caller's activity
  to whoever holds the address.
- **Does an embedding application want more than one view?** One per session is
  what this specifies. Two frames onto one machine is conceivable for a debugger,
  and nothing here forecloses it.
