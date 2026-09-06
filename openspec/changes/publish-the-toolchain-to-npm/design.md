## Context

The toolchain already builds to something package-shaped. `scripts/headless/build.mjs`
emits three entry points — the command line, the host, and the thread a machine
runs in — with their shared chunks and a build id beside them, into one
directory. The launcher scripts under `scripts/` are that directory plus a
rebuild-when-stale scan; the scan is the only part a published install has no use
for. See `docs/contributing/architecture.md` for how the client, the host and the
operation layer relate.

Three facts about the current code decide most of what follows.

**The address is derived from the build, not recorded.** `src/server/address.ts`
hashes the emitted bundles and names the socket or pipe after the first 48 bits.
Client and host each read their own `buildId.txt` and compute the same name
independently, so a host built from different source is invisible rather than
reachable and wrong.

**A ROM reaches a machine by one of three routes**, and only one of them is the
product's own images:

```
                              under node, the ROM comes from
  ┌──────────────────────┐
  │ jsbeeb-backed        │    node_modules/jsbeeb/public/roms/
  │ bbcmicro, bbcmaster, │ →  installNodeRomLoading() points jsbeeb's own
  │ atom                 │    loader there; the dialects ignore the image
  └──────────────────────┘    the seam hands them
  ┌──────────────────────┐
  │ interpreter-backed   │    nowhere - no romUrl, no ROM
  │ ge235, ge635, trs80  │ →
  └──────────────────────┘
  ┌──────────────────────┐
  │ every other machine  │    publicDir(): --rom-root, else the upward walk
  │                      │ →  findRomRoot() does from the bundle and the
  └──────────────────────┘    working directory
```

`hasRom()` in `src/dialects/bootHarness.ts` answers only the third question — is
there a file under `publicDir()` at this dialect's `romUrl`? In a checkout that
is indistinguishable from "can this machine run", because the images are always
there. Ship without them and the first group is reported as unrunnable while
booting perfectly.

**The client already looks for its host beside itself.** `src/client/discover.ts`
searches the directories `scripts/headless/cli.mts` hands it — the bundle's own
directory first, then `PATH` — for a file named exactly `basically-server`.

## Goals / Non-Goals

**Goals:**

- One installable package carrying the command line and the host, needing no
  build step and no ROM.
- `machines` and `info` report what the installation can actually run.
- A ROM location the user states once rather than per run.
- A checkout keeps working exactly as it does today.

**Non-Goals:**

- Shipping or fetching ROM images.
- Publishing the IDE or the website; the root package stays private.
- Any change to how a machine is emulated, or to what any operation answers.

## Decisions

### One package with two entry points, not two packages

Two packages would be independently resolvable, and a user could end up with a
client and a host from different versions. The failure would not be a version
error: the client computes one address, starts a host that binds another, and
reports an unreachable host after the full backoff in `src/client/connect.ts`.
An exact version pin narrows this but cannot close it, since dedupe and overrides
can defeat one.

One package makes agreement true by construction — the two bundles are always the
same build, so `buildId.txt` is the same file for both. The alternative buys a
smaller client-only install, which is worth nothing: a client with no host runs
nothing.

The published metadata lives in a hand-written `package.json` under
`scripts/headless/`, so the publish takes `dist/` with it and nothing else. The
root package stays `private: true`.

The package is `@basically/cli`. The unscoped `basically` is held by an
abandoned placeholder from 2012, and a scope is the better answer than a
hyphenated name anyway: it is a claim on the product's identity rather than a
near miss at it, and it leaves room for anything else published later. The
commands themselves are unaffected — an entry point's name is independent of the
package's, so the toolchain is still `basically` and `basically-server`, and
every documentation page that already says so stays true.

`jsbeeb` must be declared a real runtime dependency there even though it is
bundled: the Acorn ROM path resolves it through `createRequire` at run time, so
it has to be installed as well as inlined. Its version is pinned equal to the
root's, held by a test in the manner of `src/client/thinness.test.ts` — the same
pattern that already holds the website and toolchain dependency boundary.

### Launchers emitted into the bundle directory, not npm's generated shims

The build writes `basically`, `basically-server` and their `.cmd` twins beside
the bundles, and the package's entry points name those rather than the `.mjs`
files. Two reasons, both load-bearing:

- **Host discovery.** `findHostPrograms` looks for a file named
  `basically-server` beside the client. Point the entry points at `server.mjs`
  and that name exists only in the generated shim directory, which is not on
  `PATH` for a local install — so the client would silently fall back to running
  a host as its own child and lose the machine between commands. A launcher in
  the bundle directory keeps "beside the client" true everywhere.
- **Console encoding on Windows.** `scripts/basically.cmd` sets the console
  codepage to UTF-8 around the run and restores the previous one afterwards. A
  generated shim does none of that, and the screen dumps every operation exists
  to produce would come out as mojibake in cmd.exe. Node cannot set the console
  codepage from inside the process, so this has to stay in a `.cmd`.

These are the existing launchers with the staleness scan removed. The scan stays
in `scripts/`, where there is source that can go stale.

### A machine says whether its ROM is its own concern

**This touches the `Dialect` seam.** A dialect gains a way to declare that its
ROM does not come from the product's images — the narrowest form being a flag the
three jsbeeb-backed dialects set — and `hasRom()` honours it alongside the
existing file check. The seam is the right home: which images a machine needs is
the machine's own fact, and every caller that asks "can I run this" reads the
answer through `ctx.roms` rather than deriving one.

Alternatives rejected: keying off a list of machine ids somewhere in the
toolchain (a list maintained beside the registry is exactly what the `machines`
requirement forbids), and booting the machine to find out (`machines` is
specified to read no ROM and boot nothing).

Because the seam grows a member, this needs a registry-driven test under
`src/dialects/` holding every registered machine to the rule, not a per-dialect
one.

### An installation-wide ROM root, resolved by the client

`--rom-root` exists on `run` and `check` only. An environment variable is added
with the precedence the spec states: the option on the run, then the variable,
then the upward walk `findRomRoot()` already does.

The client resolves it to an absolute path before the call, as
`scripts/headless/cli.mts` already does for `--rom-root`. That preserves the rule
the client/host split rests on: no path crosses to the host as a relative one, so
a host running somewhere else can never be confused about which directory a
caller meant.

The probe behind `ctx.roms` follows the same root, so `machines` and `info`
answer for the ROMs the caller will actually run against rather than for whatever
happens to sit near the bundle.

### The build id decides whether there is anything to publish

A release is warranted when the bundles a user would install differ from the ones
already published, and `build.mjs` already computes exactly that: `buildId.txt`
is a hash over every emitted file. It exists to key the address a host listens
on, but the question it answers — are these the same bytes? — is the same
question a release gate asks.

It is a better gate than what would otherwise be reached for:

| gate | docs-only change | comment edited in `src/` | esbuild bumped in the lockfile |
| --- | --- | --- | --- |
| a `paths:` filter on `src/**` | skips | publishes, wrongly | skips, wrongly |
| `git diff --name-only` | skips | publishes, wrongly | skips, wrongly |
| the build id | skips | skips | publishes |

The last column is the one that settles it. A minifier that emits different bytes
moves the build id, and the build id is the address — so a client from the old
version genuinely cannot reach a host from the new one. That is not a spurious
release; it is the only correct answer, and no gate written in terms of paths can
see it. The release boundary and the compatibility boundary are the same fact,
which is why one number can serve both.

What is published is asked of the registry rather than remembered: the build id
is written into the published `package.json` as a field of its own, so the gate
compares the build in hand against the build that is actually installable. A
deleted tag or a rewritten history cannot make it publish twice.

### Tags record releases, and only releases

A tag means "this commit is on the registry". Nothing else earns one: a push
whose build id matches what is published stops before a version is ever computed,
so a change to the website, the documentation or the tests leaves no tag behind.

**The tag is written after the publish succeeds, never before.** The order
matters more than it looks. Tagging first and publishing second leaves, on a
failed publish, a tag for a version that does not exist — and because the next
run counts from the newest tag, that number is spent for good and the repository
accumulates tags pointing at nothing. Publishing first makes the worst case a
release that happened without being tagged, which is a cosmetic gap a person can
close by hand.

The committed `package.json` carries a placeholder; the version that ships is set
in the working tree at release time and never committed. This keeps CI out of
`main` entirely. The alternative — bumping and committing back — has to be
excused from the checks it just triggered, needs write access to a protected
branch, and leaves release commits in the history of a repository whose history
is otherwise about the product.

**Which number to publish is asked of the registry, not of the tags**, because
the registry is what the number must not collide with:

```
latest    = the registry's newest published version
intended  = the newest cli-v* tag, if there is one

intended ahead of latest  →  publish intended
                             (a person pushed a tag asking for a minor or major)
otherwise                 →  publish latest with the patch raised
```

That is what makes a lost tag harmless. If a publish succeeds and the tag push
then fails, the next push finds the build id already on the registry and stops —
so there is no second release of the same build, and no attempt to reuse a number
that is already spent. Counting from the tags instead would try to republish the
version that just shipped and fail every run until someone noticed.

Raising the minor or major is therefore "push `cli-v0.4.0`" rather than a mode
the workflow has to be told about. The workflow only ever adds the patch digit
itself.

The tag carries the build id in its message, so what a release contains can be
read from the repository without asking the registry.

### Trusted publishing, not a token

The registry authenticates the workflow by OIDC, so there is no `NPM_TOKEN` to
hold, rotate or leak, and provenance is generated without asking. Three
consequences that are easy to get wrong:

- The runner needs npm 11.5.1 or newer and Node 22.14 or newer. The existing
  `checks` job asks for `node-version: 22`, which resolves to a Node whose
  bundled npm is too old, so the release job upgrades npm explicitly rather than
  inheriting that.
- **The workflow's filename is part of the trust configuration.** The registry
  matches it exactly, case included. Renaming or moving the file silently stops
  publishing working, which is worth a comment in the file itself.
- A trusted publisher can only be configured on a package that already exists.
  The first version therefore goes out by hand, with a token, and OIDC takes over
  from the second. This is a one-time step for a person, not something the
  workflow can bootstrap.

## Risks / Trade-offs

**A bare install runs six machines out of twenty-odd** → This is the specified
posture, not a regression: `headless-cli` already requires a ROM-less
installation to be useful for everything but running. The mitigation is honesty
plus the ROM root — `machines` says per machine what can be run, and one
environment variable turns on the rest. The documentation leads with the six that
work rather than with the ones that do not.

**The jsbeeb dependency is load-bearing in a way that is easy to break** → It is
bundled *and* resolved at runtime, so a future change that marks it external, or
that drops it from the published dependencies, would break the Acorns on an
install while every test in a checkout still passed. Pinned and held by a test.

**A stale build id could be published** → A publish that shipped bundles and a
build id from different builds would produce an installation whose client and
host never meet. The build is re-run as part of publishing rather than assumed
fresh.

**A scope has to exist before anything can be published to it** → The
`basically` organisation is created on the registry first, and a scoped package
is private by default, so the publish has to ask for public access explicitly. A
first release that silently went out private would look like a successful
publish nobody could install.

**Renaming the release workflow stops releases without failing** → The registry
matches the workflow's filename as part of deciding whether to trust it, so a
tidy-up that renames the file produces a job that runs, builds, and is refused at
the last step. A comment in the file saying its name is configured off-repository
is the only guard available.

**Two pushes landing together could race for one version** → Both would read the
same published version and try to claim the same next number; the second publish
is refused. The job runs one at a time, so the loser is a push that reaches
`main` and is released by the run after it rather than a release that is lost.

**A release could end up untagged** → Publishing before tagging means a tag push
that fails leaves a version on the registry with nothing in the repository
marking it. This is the deliberate side the trade-off falls on: the alternative
ordering strands tags for versions that do not exist, which corrupts the record
rather than merely leaving a hole in it. The gap is visible — the newest tag is
behind the registry — and closing it is tagging the commit by hand. Nothing
retries into a second release, because the build id already matches.

**The gate depends on a reproducible build** → Two runs of the same commit have
to produce the same build id, or the gate would publish on every push. It holds
because the toolchain is built with a locked dependency tree; a change that made
the bundle carry a timestamp or a build-machine path would break the gate
quietly, by publishing constantly rather than by failing.

**Provenance and third-party code** → The tarball contains bundled third-party
emulator cores. Trusted publishing attaches provenance without being asked, which
gives a verifiable link from tarball to commit — worth having for GPL compliance
questions, and free here.

## Migration Plan

Nothing to migrate. A checkout is unaffected — its launchers, its build and its
addresses are unchanged — and there is no existing published package whose users
could be broken.

Bringing the release path up is three steps in order, the first two done by a
person once:

1. Create the `basically` organisation, and publish the first version by hand
   with a token. Nothing can be configured to trust the workflow until a package
   is there to configure.
2. Configure the trusted publisher on the registry against this repository and
   the release workflow's exact filename, then tag that first release `cli-v…` so
   the workflow has a tag to count from.
3. Merge the workflow. From here every push to `main` whose build id differs from
   what is published raises the patch, tags, and publishes over OIDC.

Rolling back a bad release is deprecating the version and letting the next push
supersede it. Unpublishing is the worse option: the version number stays spent,
and anyone who installed it loses the package under them. The repository itself
never depends on the package, so nothing here breaks either way.

## Open Questions

- Whether the new documentation page joins the sidebar. Adding a page does not
  imply adding it to the sidebar, so this is asked separately and the sidebar is
  left untouched until then.
