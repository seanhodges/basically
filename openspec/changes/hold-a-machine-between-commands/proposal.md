## Why

The command line cannot hold a machine between invocations, so everything a
caller asks of a running machine — press this, look, measure — it has to ask of
one run, as an option on that run. The agent server already holds a machine
between requests and reaches those same operations as operations; the command
line reaches them as options only because its process ends. That is a limit of
how the toolchain is packaged, not of what it can do.

The same packaging makes every invocation pay for a machine it may not use: an
installation with no ROMs still loads every emulator to answer `lint`, and an
editor and an agent each spawn a private copy of the whole toolchain rather than
sharing one that is already warm.

## What Changes

- The toolchain outside the browser splits in two: a long-running server that
  holds the loaded toolchain, the ROMs and at most one machine per session, and
  a thin command line that parses what the user asked for, reads and writes the
  files involved, and asks the server to do the work.
- The server serves three conversations — the command line's operations, an
  editor's language server, and an agent's protocol — and may be started serving
  any of them or all of them.
- **A machine stays up between commands.** `run` may leave its machine running,
  and later commands act on the machine the earlier one left, until it is
  released or the server lets it go. What the agent server already offers, the
  command line now offers too.
- The seven operations that need a machine (`drive`, `look`, `screenshot`,
  `profile`, `time`, `variables`, `expect`) become operations of the command
  line in their own right, alongside the options on `run` and `check` that
  remain the one-shot spelling of the same thing.
- The command line finds a running server, starts one if there is none, and can
  stop one. A server is found by the user it belongs to and the version it was
  built from, so a command never reaches a server built from different source.
- Starting a server over its standard streams keeps working exactly as it does
  today, so an editor or an agent that spawns the toolchain itself is unaffected.
  **Not breaking.**

## Capabilities

### New Capabilities

- `toolchain-daemon`: A long-running host for the toolchain outside the browser —
  how it is started, found, shared between callers, and stopped; what a caller
  that finds none does; and what it guarantees about the machines it holds.

### Modified Capabilities

- `headless-cli`: The requirement that parity is of capability rather than of
  invocation is justified today by "an invocation of the command line holds no
  machine between runs". That ceases to be true. The command line gains a machine
  held between commands and gains the operations that act on one.
- `mcp-server`: Gains that it may be served from a shared host rather than only
  from a process started for one client, without changing what it offers or what
  a client that starts it over standard streams sees.
- `language-server`: The same — it may be served from the shared host, and an
  editor that spawns it over standard streams sees no difference.

## Non-goals

- **No network.** The server is reached over a socket the operating system
  protects by ownership — a Unix domain socket, or a named pipe on Windows. No
  port is bound, nothing is reachable from another machine, and no
  authentication scheme is invented beyond the one the filesystem already
  enforces.
- **No change to what any operation does.** Every answer is the answer the
  toolchain gives today; only where the work happens changes.
- **No installation or publishing story.** The server is reached the way the
  command line already is, by a script beside it in the project. Putting either
  on a user's `PATH` as an installed program is a separate question.
- **No change to the browser IDE**, to the assistant, or to the
  `Dialect`/`MachineEmulator` seam.
- **No sharing of a machine between callers.** A machine belongs to the session
  that asked for it; this change does not make two callers drive one machine.

## Impact

- **The toolchain's process boundary** — `scripts/basically` becomes a client and
  gains a server beside it; the operations that were subcommands of a one-shot
  process become conversations with a server.
- **The parity model** (`src/ops/`) — the route each operation declares for the
  command line changes for the seven that need a machine, and the reasoning that
  justified routing them as options no longer holds. The registry-driven parity
  check enforces this in both directions, so the change cannot be half-made.
- **`src/mcp/` and `src/lsp/` are unchanged.** Only the streams they are handed
  differ; everything that decides an answer stays where it is.
- **New platform surface**: socket and named-pipe addressing, process discovery
  and spawning, and a lifetime to manage — all of which must behave the same on
  Windows, macOS and Linux.
- **Documentation**: `docs/contributing/architecture.md`'s account of the
  toolchain outside the browser, and the user-facing pages that tell an editor
  and an agent how to start a server.
