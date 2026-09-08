## Why

The toolchain can be installed, but it can only be *run*. Everything it does —
describing a machine, checking a listing, building one into the file its machine
loads, booting one and reading its screen back — is reachable only as a command
that writes to a terminal, so a program that wants any of it has to spawn
`basically` and parse what comes out. What it would actually be asking for is a
function call: the operation layer already exists, already takes everything it
needs through a context handed in from outside, and already serves three callers
this way.

The same publish also carries two servers nobody can currently obtain except by
installing the whole command line. An editor's language server and an agent's
Model Context Protocol server have nothing to do with a command line; they are
programs an editor or a client starts, and they belong under their own names.
Taking them out of the command line is the first half of that, and the library is
what keeps them reachable in the meantime.

## What Changes

- The toolchain becomes obtainable as a library, under a name of its own, so
  another program can describe machines, check and build programs, boot one and
  act on it without spawning anything or reading a terminal.
- Every operation the toolchain declares is reachable from that library. It is a
  caller like any other, and the rule that a caller either offers an operation or
  declares its absence with a reason applies to it from the start.
- The library states where its ROMs are read from rather than searching for them.
  A library is loaded from inside somebody else's project, and the upward walk
  that serves a person typing a command in a directory would be a guess there.
- **BREAKING**: the command line no longer serves an editor or an agent. Both
  servers keep working, and keep offering everything they offer today, but they
  are reached by embedding the library rather than by a command.
- **BREAKING**: asking the command line what it can do no longer names either
  server among its operations, because neither is one of its operations any more.
- The pages telling a reader to start those servers from the command line are
  removed. What replaces them is an account of embedding the library; a page for
  each server returns when there is a package to put on it.
- Two published packages, one build, one version. A published version means the
  same build of the same commit in both, so no combination of them can disagree.

## Capabilities

### New Capabilities

None. The library is the existing toolchain becoming reachable by another
program, and the two servers already have capabilities of their own.

### Modified Capabilities

- `headless-cli`: gains a requirement that the toolchain can be embedded in
  another program — every operation reachable from it, no checkout or build step
  needed, no ROM carried, and where ROMs are read from stated by the embedder
  rather than searched for.
- `language-server`: the requirement that an editor can be served changes in one
  respect only. The product provides a server that speaks the protocol over
  streams a program supplies; it no longer provides one the user or their editor
  starts. Everything the server answers, and the rule that it answers all of it
  without a ROM, is unchanged.
- `mcp-server`: the same change to how the server is reached, and the removal of
  the clause requiring that asking the command line what it can do names the
  server and says how a client starts it. That clause describes a command this
  change deletes.

The requirement that every operation the toolchain offers is offered over the
Model Context Protocol is untouched, and still carries no declared absence: the
server is unchanged, and only the way it is started has moved.

## Non-goals

- **Publishing a language server or an agent server package.** Both are extracted
  under their own names later. This change stops the command line carrying them
  and leaves the library holding them; it does not decide what they are called or
  how they are started.
- **Making the library depend on the command line, or the command line on the
  library.** Neither resolves the other at run time. They are built together and
  published together, which is what makes them agree.
- **Publishing the IDE or the website.** The root package stays private.
- **Redistributing ROM images.** Unchanged: none ships, and none is fetched on a
  user's behalf.
- **Taking the editor off the `Dialect` seam.** Every dialect builds its
  completion source when its module is loaded, so anything holding the registry
  holds the editor packages too. That is a cost this change carries rather than
  one it pays off.
- **A browser build of the library.** Node only. What the browser needs of this
  code it already imports from source.
- **Changing what any operation answers**, or how a machine is emulated.

## Impact

- **A second published package** — a hand-written manifest and a build of its own
  beside the existing one, emitting a bundle, its type declarations and a build
  id into a directory of its own, so the command line's build id keeps covering
  exactly the command line's own files.
- **A public surface** — a facade module gathering what the library offers, with
  a test pinning it, so widening it is an edit rather than a side effect.
- **Two modules move out of the servers they are named after.** The held machine
  and the context that fills it are what the command line's own host uses to keep
  a machine between commands; they are library, not agent server, and the module
  that fills a context from a real filesystem is library rather than command line.
  Both moves close a sideways import that exists today.
- **The command line loses its two server operations**, their argument parsing,
  their help, the flags on the host that answered them, and with them the two
  protocol libraries and the reference pages one of them reached. The socket
  between a client and its host carries one kind of conversation afterwards.
- **Release** — one version for both packages, published in an order that cannot
  strand a number, gated by the same comparison of build ids that gates the
  command line today. Removing two operations is breaking, so the first release
  after this raises the minor.
- **Documentation** — two guide pages removed, their inbound links with them; a
  page on embedding, stating what the licence obliges of anyone who does; the
  architecture map updated where it describes the two programs and their servers.
