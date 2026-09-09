## Why

The toolchain outside the browser holds a machine between calls: an agent runs a
program, presses a key, looks at the screen, and the machine one request left is
the machine the next one sees. But the only way to *see* that machine is to ask
for a still picture, one request at a time. Nobody can watch it.

That gap is felt in two places. A person supervising an agent has no way to keep
eyes on the screen while the agent works — they can ask what it looks like, and
get the answer to a question they had to know to ask. And an application that
embeds the toolchain but cannot carry the browser IDE — a desktop or mobile app,
a harness with a web view — has no way to show its user the machine it is
driving, even though it is the one that started it.

The picture already exists; there is simply no way to keep receiving it.

## What Changes

- **A held machine's display can be projected to a view an embedding
  application can show.** A caller that holds a machine may ask for a view of
  it, and is given an address; anything that can show a web page can show what
  is at that address, in a frame of its own.
- **The view mirrors the machine; it does not run it.** The machine still
  advances only when a request asks it to, so between requests the view holds a
  still picture, and while a request is working the view follows it. Nothing
  about a machine's timing, its measurements, or what a request costs changes
  because someone is watching.
- **A viewer is not a caller.** It holds no machine, runs no operation, and
  cannot type at, start, stop or otherwise reach the machine it shows. It
  receives a picture and nothing else. This is what lets a machine be watched
  without being shared: the caller that holds it is still the only one that
  acts on it.
- **The projection is the only part of the toolchain reachable over a network
  address, and only while it is asked for.** No view is projected unless a
  caller asks for one; the address is reachable only from the same computer;
  possession of the address is what admits a viewer; and the projection ends
  with the caller that asked for it. Every other conversation the host serves is
  unchanged and stays on the channel the operating system already protects.
- **Asking for a view is an operation**, so the command line and an agent both
  reach it on the same terms as everything else the toolchain offers. The
  assistant in the browser IDE deliberately does not offer it, because the
  machine it would project is already on the screen in front of the user.
- No existing behaviour changes and nothing is removed. **Not breaking.**

## Capabilities

### New Capabilities

- `display-view`: Projecting a held machine's display to something that can show
  a web page — what a caller must do to get one, what a viewer may and may not
  do with it, what the view shows as the machine changes and when nothing is
  running, who is admitted, and when the projection ends.

### Modified Capabilities

- `toolchain-daemon`: The host serves a fourth thing — a projection — beside the
  three conversations it serves today. Two requirements change. The guarantee
  about who may reach the host, and about nobody having to name an address or
  present a secret, is currently open to being read as covering everything the
  host serves; it is amended to say that it is a guarantee about **callers**, and
  that a projection is governed by `display-view` instead. And the guarantee that
  what one caller does to its machine is invisible to every other is amended to
  say that a projection its own holder asked for is not an exception to it.

`mcp-server` and `headless-cli` need no delta. Both already require that every
operation the toolchain declares is reachable from every caller, and that a
declared absence carries a reason particular to the caller it is claimed of — so
the new operation and its absence from the assistant are already governed by
requirements that stand unchanged.

## Non-goals

- **No input from the view.** A viewer cannot press a key, start or stop the
  machine, or reach the toolchain in any way. This is what keeps "a machine
  belongs to one caller" true, and it is a decision to revisit deliberately
  later, not an omission.
- **No sound.** With the machine advancing only when a request asks it to, audio
  would arrive in bursts unrelated to the time a listener is living in. A view
  that ticked in real time could carry sound; this one cannot meaningfully.
- **No recording, no seeking, no history.** The view shows what the machine
  shows now. It is not a video file and nothing is kept.
- **No access from another computer, and no accounts.** The address is reachable
  from the same computer only. Nothing here invents a login, a role, or a user.
- **No view of a machine nobody holds.** A view is of a caller's machine. This
  change does not let a viewer start a machine, nor two callers share one.
- **No change to the browser IDE, to the assistant, or to the
  `Dialect`/`MachineEmulator` seam.** Nothing here reaches a dialect, an
  emulator, or a bus.
- **No change to what any operation does or answers.**

## Impact

- **The host gains a surface it has never had.** Until now every way to reach
  the toolchain was protected by the operating system's ownership of a channel.
  A projection cannot be, because the thing that shows it is a web page. What
  replaces that protection — and the fact that it is the only thing protecting
  it — becomes a stated guarantee rather than an implementation detail.
- **`toolchain-daemon`'s account of who may reach the host** is read today as
  covering everything the host serves. It has to be read as covering callers,
  and say so.
- **The parity model** gains an operation and a declared absence from the
  assistant. The registry-driven check holds both directions, so the absence
  cannot outlive its reason.
- **Sequencing.** This change modifies a capability that is not yet part of the
  baseline, and it changes the security posture of a toolchain that is in the
  middle of becoming installable. Both of those land first.
- **Documentation**: the account of the toolchain outside the browser, and a
  page telling an embedding application how to obtain and use a view.
