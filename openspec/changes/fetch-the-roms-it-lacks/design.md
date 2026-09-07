## Context

Today the node side of the toolchain reads ROMs off disk and nothing else:
`bootHarness.ts` holds a module-level root, `findRomRoot()` walks up from the
bundle's own directory and from the working directory looking for a `public/`
that contains `roms`, and three callers — the headless runner, the MCP session
and the CLI's `OpContext` — each point the harness at whatever it found. Reads
are synchronous and a missing file is an empty image, never an error. The
architecture map covers that shape and the "a missing ROM is a state, not a
crash" rule that hangs off it; see `docs/contributing/architecture.md`.

Two properties of the surrounding code decide most of this design.

**The command line is a client, not the process that reads the ROM.** `basically`
connects to (or starts) a host, and the host runs operations in a worker. The
host has no stdin and no terminal. So a question can only be asked in
`scripts/headless/cli.mts`.

**`src/ops/` may not import node.** `eslint.config.js` refuses `fs`, `path`,
`os` and `node:*` there, because the same operations run in the browser. So the
cache, the manifest and the prompt cannot live in the operation layer, and what
an operation knows about ROMs stays what it knows now: a `RomProbe` that answers
whether one is present.

The publisher side already exists and is not ours to change: `GET /roms/index.json`
returns `{version, archive, roms:[{path, bytes, sha256}]}` with a
content-derived `version` and an `ETag`, images are `max-age=86400`, and the
manifest is `max-age=300`. Only the images are obtained: a publisher that serves
the images it was asked for need not serve a notice too, so the terms are named
by the address they are always readable at rather than fetched from a place that
may answer 404.

## Goals / Non-Goals

**Goals:**

- Obtain a machine's ROM when the installation has none, so that running the
  toolchain outside a checkout is useful rather than blocked.
- Ask once, before anything is written, and make the terms readable at the point
  of asking.
- Never block a caller that has no terminal, and never make a caller that
  already has ROMs pay for any of this.
- Keep an obtained set current on its own, including removals, without asking
  again.
- Leave one seam behind that the browser change can reuse without reshaping.

**Non-Goals:**

- The browser's ROM source. It keeps fetching from its own origin. The follow-up
  change owns `src/app/romImage.ts`, the three machines that fetch their own
  sets, and jsbeeb's single global base.
- Removing the committed images. `public/roms/**` is what the publisher mirrors
  at synth time, what the unit suite boots, and what a checkout reads instead of
  the network.
- Any change to the publisher, to packaging, or to the language server (which
  reads no ROM at all).

## Impact on the Dialect seam

**None.** `Dialect.romUrl` and `Dialect.romBytes` keep their meanings, no member
is added or removed, and `createEmulator` keeps receiving exactly the bytes it
receives now. Every machine still constructs on an empty image and still draws
its own missing-image notice, so the "a missing ROM is a state, not a crash"
battery is unaffected — declining consent lands a machine in exactly that state,
which is why declining needs no new behaviour anywhere in `src/dialects/` or
`src/emulator/`.

The one addition next to the seam is a pure helper for reading a ROM reference:
the path tail behind a `romUrl`, and the base a published set is read from. It
imports nothing, so both the node side and (later) the browser can use it.

## Decisions

### The cache is a rom root, not a new kind of storage

The obtained images are written in exactly the `public/` shape — `<home>/roms/<tail>` —
so the cache directory is something `configureRomRoot()` already accepts. Nothing
downstream learns a second way to find a ROM.

The alternative, a content-addressed store keyed by digest with a lookup layer
above it, would deduplicate the one image two machines share (the Ataris) and
buy nothing else, at the cost of a real abstraction between the harness and the
bytes. Not worth it for a set of about 527 KiB.

### `findRomRoot()` gains the cache; nothing else is rewired

The cache is added as a candidate inside `findRomRoot()` rather than at each call
site. That one edit reaches the headless runner, the MCP session and the CLI's
`OpContext` together, so `machines`, `info` and the ROM probe all see an obtained
set without new plumbing.

This also closed a gap that was there before: `--rom-root` reached the runner but
not the probe, because a host builds its context knowing nothing about the call.
The probe therefore answered from whatever ROMs it found on disk while the run
read the named directory — so `check --rom-root /nowhere` was not refused, it
ran, and reached a verdict about a machine that had drawn its missing-image
notice. The probe is now asked *about* a root (`RomProbe.present(dialect,
romRoot?)`), which the two operations whose input carries one pass through.
Along with it, `configureRomRoot` takes `null` and is always called: it is a
global and a host serves many calls, so a call that named a directory was
leaving every later call reading it.

`findRomRoot()` stays read-only: it never downloads and never prompts. Discovery
and acquisition are separate, which is what lets `machines` report honestly
without touching the network.

### Order: what the user said, then what was obtained, then what is installed

`--rom-root` wins outright — a user naming a directory means that directory. The
cache comes next, because it is the one source the tool verified against a
manifest and the one it keeps current. The installation's own `public/` comes
last, and reaching it means nothing is obtained and nothing is asked.

A cache can therefore shadow a checkout, which would be baffling if it were
invisible. `roms status` prints the root in use *and why it was chosen*, and
`roms clear` removes the shadow.

### All network and all interaction live in the client process

The host has no terminal, so the prompt has to be in `cli.mts`; and once the
prompt is there, the fetch belongs beside it rather than split across a process
boundary. The host and worker keep doing plain synchronous reads against a root
they are handed. This also keeps `src/ops/` importing no node, which is not a
style preference but the rule that lets the browser run the same operations.

Consequence worth stating: the prompt must be decided **before** the client reads
the program from stdin, because `run` and `check` already consume stdin for the
program and cannot then read an answer from it.

### Consent is one record, not one per image

The user is agreeing to obtain ROM images from the publisher, on the terms
`ATTRIBUTION.md` sets out — not to a particular version of a particular set. So
the record is one file, and every later image and every later refresh is covered.
Asking per machine would be both noisier and less honest about what was agreed.

Three ways to have already agreed: the environment setting, a deliberate
`roms accept`, or simply having the images already (in which case nothing is
obtained and the question never arises). The first two exist because an agent, a
CI job or an editor-served session has nobody to ask.

### Refresh: conditional, occasional, and unable to fail a command

The manifest carries a content-derived `version` and an `ETag`, so the steady
state is one conditional request answered `304`. A day between checks matches the
publisher's own `max-age` on the images. A registered machine whose ROM tail is
absent from the held manifest makes a check due immediately — otherwise a newly
added machine would be unrunnable for up to a day for no reason.

Everything about the refresh is bounded and swallowed: a timeout, and any
failure at all leaves what is held untouched and says nothing on the command's
own output. A `run` that would have worked offline must still work offline. The
places a refresh problem is actually reported are `roms status` and `roms fetch`,
where the user asked about ROMs.

A withdrawal has to propagate: the publisher's deployment prunes, so an image the
manifest no longer lists is deleted from the cache. Without that the takedown
path this whole change rests on stops at the bucket, and every installation keeps
its copy for good.

### Digests are verified; length is not enough

The publisher ships a `sha256` per image precisely because a length check cannot
tell a real image from a plausible-length error page. Node has `node:crypto`, so
the node side verifies the digest and writes through a temporary name so an
interrupted download never leaves a half image behind. (The browser can only
check length, which is why the follow-up change keeps its existing size check.)

### `roms` is a command, not an operation

The project's rule is that an operation is declared once and both surfaces derive
from it. `roms` is not one: it needs the filesystem and the network, which
`src/ops/` forbids by design, and it manages state belonging to one surface — a
download cache and a consent record — rather than answering a question about a
program or a machine. It is the same category of thing as `--rom-root`.

So it is answered locally in the client, as `help` already is, and it takes no
`src/ops/parity.ts` exemption, because the parity test iterates declared
operations and this is not one.

The alternative — declare it, take its store through `OpContext`, and exempt the
assistant and the server — was considered and rejected: the browser has no ROM
cache to manage, and a server has no terminal to be asked in, so both exemptions
would say the same thing twice and the declaration would earn nothing.

### The base URL comes from the build, with an override

The set is published by the share server, so its address is the share server's
address: the build is handed one origin (`VITE_SHARE_API_URL`, the same variable
the web build already reads) and the ROM set is the `roms/` under it. Committing
the address instead would spell the same server twice — once as a deployment
variable and once in the source — and leave the checked-in half wrong the day the
server moves.

A build told nothing names no publisher, and that is a state rather than a
failure: it obtains nothing, asks nothing, and says so, which is exactly where an
installation with no ROMs already stood. A checkout is unaffected, because it
reads its own `public/roms` and never reaches for a publisher; `BASICALLY_ROMS_URL`
names one at runtime for an installation that needs it. The override stays a whole
ROM base rather than an origin, because what it exists for is a set that has moved
on its own.

## Risks / Trade-offs

- **A stale cache shadows a checkout a developer is editing.** `romLayout.test.ts`
  would not catch it, because it checks the committed tree. → `roms status` names
  the root in use and why; `roms clear` removes it; `--rom-root` overrides it
  outright.
- **A refresh adds an outbound request to a command that made none.** → At most
  daily, only when the cache is the root in use, only after consent, timeout-bounded,
  and skippable with the environment setting. A checkout never refreshes because it
  never reaches the cache.
- **The prompt is the first interactive thing in a toolchain that has none, and
  `run`/`check` already read stdin.** A prompt in the wrong order would hang on a
  pipe. → The TTY check is on both streams, a non-TTY returns immediately without
  reading, and consent is decided before the program is read.
- **Deleting images on a manifest change is destructive by design.** A manifest
  fetched from the wrong origin could empty a user's cache. → Pruning only happens
  after a manifest is fetched and parsed successfully, only removes files inside
  the tool's own cache directory, and never touches `--rom-root` or the
  installation's `public/`.
- **A build made without the address quietly carries no publisher.** A locally
  rebuilt bundle downloads nothing where the released one would. → It is what
  `roms` reports first, the run that would have asked stands down silently rather
  than putting a question it could not act on, and a checkout - which is what a
  local build has - reads its own images anyway.
- **A wrong or moved base is a redeploy away.** → The environment override is the
  escape, and a wrong base degrades to "cannot obtain ROMs" rather than to a
  broken command.
- **Node's global `fetch` is stubbed by `installNodeRomLoading()`** so machines
  that fetch their own sets read from disk. The cache's own fetching runs in the
  client process, before and outside any of that, so the two never overlap — but
  a future move of the fetching into the host would collide, and this is the
  reason not to.
