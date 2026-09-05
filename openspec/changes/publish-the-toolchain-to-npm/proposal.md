## Why

The toolchain outside the browser — the command line, the language server, the
Model Context Protocol server, and the host that holds a machine between calls —
can only be reached from a checkout. The documentation is already written as
though it were installed: the language server guide and the MCP reference both
tell the reader to type `basically-server`, with nothing anywhere saying how they
would come to have that command. An agent that wants the MCP server has to clone
a repository and know about a build step to get it.

The behaviour this needs is already specified. `headless-cli` states that
describing machines, checking a program and building one all work "without any
ROM being present, so that an installation carrying no ROMs is still useful for
everything but running" — a sentence that describes an installation the product
has no way to produce. Publishing the toolchain is what makes both that
requirement and those pages true.

## What Changes

- The toolchain becomes obtainable under its own name, without a checkout, as a
  single package carrying both the command line and the host.
- The package carries no ROM images. Six registered machines still run on a bare
  install — the jsbeeb-backed Acorns, whose ROMs come from that emulator's own
  published package, and the interpreter-backed dialects, which need no ROM at
  all. Every other machine needs the user to say where ROMs are read from.
- **A machine reports whether *this installation can run it*, rather than whether
  a file sits at a path under the install.** Today those two are the same
  sentence only because a checkout always carries the images. On a ROM-less
  install the Acorns would be reported as having no ROM while booting perfectly,
  which would tell a caller — and an agent reading the same answer through MCP —
  not to attempt a machine that works.
- Where ROMs are read from can be said once for the installation, rather than
  only as an option on each run.
- The command line and the host of one installation find each other, so a machine
  is still held between commands when the toolchain was installed rather than
  checked out.
- A version is published, and tagged in the repository, whenever the built
  toolchain differs from what is already published — and only then. A change that
  does not reach the bundles, such as one to the website or the documentation,
  publishes nothing.

No breaking change: a checkout keeps its existing launchers and its existing
behaviour, and every operation answers as it does today.

## Capabilities

### New Capabilities

None. Nothing here is a capability the product lacks — this is the existing
toolchain becoming obtainable.

### Modified Capabilities

- `headless-cli`: gains a requirement that the toolchain can be obtained and run
  without a checkout, with the command line and the host of one installation
  finding each other, and with a published version standing for exactly one
  build. Two existing requirements change: listing machines reports whether the
  installation can run each machine rather than whether an image is filed under
  it, and where ROMs are read from becomes something that can be said once for
  the installation rather than per run.

How releases are produced is infrastructure and gets no spec delta; what a
published version guarantees is behaviour and is covered above.

`mcp-server` and `language-server` need no delta: both already require every
operation to be reachable and answered identically from every caller, so they
inherit the corrected ROM reporting through that rule rather than restating it.

## Non-goals

- **Publishing the IDE or the website.** The root package stays private; this
  publishes the toolchain only.
- **Redistributing ROM images.** No image ships, and no image is fetched on the
  user's behalf. The Sinclair set carries a redistribution permission and the
  rest rest on de-facto tolerance; keeping one rule for all of them is simpler
  to hold than a list of exceptions, and a public registry is a weaker footing
  for tolerance than a source checkout.
- **A ROM download command.** Pointing an install at ROMs the user already has is
  in scope; acquiring them for the user is not.
- **Changing how a checkout is worked in.** The existing launchers keep their
  rebuild-when-stale behaviour, which is what a checkout wants and an install
  has no use for.
- **Splitting the client and the host into separate packages.** The address a
  host listens on is derived from what it was built from, so two independently
  resolvable packages could disagree and fail as an unreachable host rather than
  as a version error.

## Impact

- **Built artifact** — `scripts/headless/build.mjs` gains the launchers the
  package's entry points point at, emitted beside the bundles it already writes.
- **The `Dialect` seam** (`src/dialects/types.ts`) gains a way for a machine to
  say its ROM does not come from the product's own images, which
  `src/dialects/bootHarness.ts` honours when answering whether a ROM is present.
  Three dialects set it.
- **Argument parsing and the operation context** — `src/cli/args.ts` and the ROM
  probe behind `src/ops/types.ts` learn an installation-wide ROM root.
- **Dependencies** — the jsbeeb package becomes a declared runtime dependency of
  the published package, because the Acorn ROM path resolves it at runtime rather
  than only bundling it.
- **Documentation** — a new guide page on installing and on ROMs; the language
  server guide and the MCP reference link to it.
- **CI** — a release workflow on pushes to `main`, authenticated to the registry
  by OIDC rather than by a stored token, gated on the build id the toolchain's
  build already computes, and recording each release as a tag.
