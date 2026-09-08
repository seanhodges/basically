## Context

The operation layer was built to be reached from more than one place, and already
is: `src/ops/` declares each operation once, takes everything it needs from an
`OpContext` handed in by whoever is calling, and imports neither the filesystem,
the DOM nor the store — a rule `eslint.config.js` enforces rather than merely
states. Three contexts fill it today: one over a real filesystem, one over a held
machine, and one over the browser's. See `docs/contributing/architecture.md` for
how the client, the host and that layer relate.

So the library is not a new abstraction. It is a fourth context, a module naming
what is offered, a second bundle, and a manifest. What takes thought is which
parts of the existing arrangement the split is allowed to disturb, and there is
exactly one that matters.

**The build id is the address.** `src/server/address.ts` hashes the emitted
bundles and names the socket or pipe after the first 48 bits. Client and host
each read their own `buildId.txt` and compute the same name independently, which
is what makes a host built from different source invisible rather than reachable
and wrong. Anything that puts bytes the two programs run outside that hash breaks
the guarantee silently — the failure is not a version error but a client that
waits out its whole backoff and reports an unreachable host.

Two facts about the current code decide the rest.

**Three modules are named after the wrong thing.**

```
  src/server/machineWorker.ts ──imports──> src/mcp/session.ts   (createServerMachine)
                              └─imports──> src/mcp/context.ts   (serverContext)
                                                  └─imports──> src/cli/roms.ts
```

That is the *ops* host holding a machine between commands. Nothing in that path
speaks the Model Context Protocol, and nothing in it parses an argument. The
folder names are historical, and they are why removing the agent server from the
command line looks, at first reading, like it would take the held machine with it.

**Everything holding the dialect registry holds the editor.** Every dialect's
`language.ts` builds its completion source at module scope, so
`src/dialects/registry.ts` pulls `@codemirror/{state,view,language,autocomplete}`
into any graph that touches it. `src/client/thinness.test.ts` and
`src/build/webBoundary.test.ts` both say in comments that no import rule fixes
this. The library inherits it.

## Goals / Non-Goals

**Goals:**

- A library another program can install and call, carrying the whole headless
  toolchain, needing no checkout and no build step.
- Every operation reachable from it, held to that by the same test that holds
  every other caller.
- A command line that no longer carries an editor's server or an agent's, with
  both still working from the library.
- Every guarantee the command line makes today, unchanged — the address above all.

**Non-Goals:**

- Packaging either server under its own name. That is the next change.
- A browser build of the library.
- Any change to what an operation answers, or to how a machine is emulated.
- Taking the editor off the `Dialect` seam.

## Decisions

### The command line stays self-contained; it does not install the library

The obvious reading of "split the package" is that the command line declares the
library as a dependency and resolves it at run time. That is the one arrangement
this must not have.

Mark the library external and its bytes leave `buildId.txt`. Two installations of
the same command-line version, resolving different library versions — through a
transitive dedupe, an override, a hoist — compute the *same* address while running
different code. The client then finds a host that answers, and the two disagree
about what an operation does. An exact pin narrows this and cannot close it, which
is the same reasoning that kept the client and the host in one package.

So the two packages are built from one source tree, in one run, and published
together at one version. Neither resolves the other:

```
  one commit ──> one build ──┬──> the command line's bundles + launchers + build id
                             │      (the address, over exactly these files)
                             │
                             └──> the library's bundle + declarations + build id
```

The cost is duplicated bytes for anyone who installs both, and two copies of the
emulators in one process if an embedder also shells out to the command line.
Neither is a correctness problem, and the alternative's failure is silent.

This is worth stating plainly because it is not what "the command line depends on
the library" would normally mean: the dependency is on the source, and the
agreement is made by the build rather than by a resolver.

### The library's bundle is built separately, into a directory of its own

Not a fourth entry point beside the existing three. The build id is a hash over
every file in the output directory, so a library bundle sitting beside the command
line's would move the address every time the library's surface changed, and a
command line that had not changed at all would be a different program.

A build of its own also lets the two differ where they should:

| | the command line | the library |
| --- | --- | --- |
| minified | yes | **no** — an embedder reads these stack traces |
| declarations | none | emitted, and the entry point of the package |
| `keepNames` | yes | yes — `RunError` and the charset errors are matched by class name, and an embedder catches them for the same reason the client does |
| entry points | three | one |

Everything else is shared with the existing build and must stay shared: the `?raw`
plugin standing in for Vite's, the `define` supplying `import.meta.env` (every
ROM-bearing dialect reads `BASE_URL` from it), and the banner that supplies a real
`require` and neutralises the `localStorage` probe.

Type declarations are the one unknown worth naming. `tsc --emitDeclarationOnly`
over a library-only configuration is the answer that adds no dependency, and it
may not survive contact with `src/dialects/types.ts` — declaration emit rejects an
exported type that names one it cannot reach, which a build that only checks types
never notices. If it does not hold, the fallback is a declaration bundler, which
is a new devDependency and needs the licence check every dependency here gets.
Settle this before the rest of the work depends on it.

### A facade, not a folder

What the library offers is one module that names it. Not `export *` over the
module tree: internals move, and a published surface that follows them turns every
refactor into a breaking change.

Four groups, and the boundary between them and the command line is the process:

| | in the library | stays in the command line |
| --- | --- | --- |
| machines, language, building | yes | — |
| the operation registry and a dispatcher | yes | — |
| running: one-shot, and a machine held in process | yes | — |
| serving an editor or an agent over supplied streams | yes | — |
| argument parsing, help, terminal formatting | — | yes |
| finding a host, starting one, the socket and its framing | — | yes |
| the ROM cache, and asking a person about it | — | yes |

The library gives a program operations it calls; the command line gives a person a
process boundary and a machine held between *commands*. That is a line an
implementer can apply to a module they are unsure about.

A test pins the surface, in the manner of `src/client/thinness.test.ts`: read over
the real dependency graph so a failure names the import that did it, not a number
that moved. It holds two things — that the library reaches nothing under the
command line, the client, the socket, the components or the store, and that its
exported names are the ones recorded.

### The embedder is a caller, and the parity rule applies to it from the start

`src/ops/parity.ts` records which caller deliberately lacks which operation and
why, and its test fails in both directions. Adding the library there is not
bookkeeping: the spec requires that adding a caller *widens* what the toolchain
offers rather than inheriting what was withheld from another, and the library is
the first caller added since that sentence was written.

Reachability for it is structural — the facade exports the registry and a
dispatcher that takes an operation by name, so no operation can be offered to one
caller and not this one without someone writing a filter. The test therefore asks
the facade's own re-exports rather than answering `true`, so a filter would fail
it. The library declares no absence, and the three the assistant declares do not
travel to it: each names the IDE around that caller, and the library has none.

The agent server remains a caller with no declared absence. Its launcher moving
does not change what it offers.

### The two servers leave the command line, and the socket carries one conversation

Removing them takes with it the argument parsing, the help, the flags on the host
that answered them, and — the point of the exercise — both protocol libraries,
their JSON-schema dependencies, and most of the machine-reference pages, which the
editor server reaches through a dynamic import for its hover text.

`Conversation` collapses to one value. It exists because a listening host could
hand a socket to whichever server the caller asked for, and once no caller asks,
a one-value union is generality with nothing behind it. The servers themselves
need none of it: both already take the streams they speak over as an argument and
never read `process`, which `src/server/servedOverStreams.test.ts` proves and which
is exactly why they work from a library at all. That test stops being a check on a
detail and becomes the only proof either server works; it moves with them.

Alternative rejected: keeping the flags and the union so the extracted packages can
reuse them. Those packages will choose their own transport, and code kept for a use
nobody has yet is code no test exercises.

### Three modules move to where they belong

The held machine and the context that fills it are the ops host's, not the agent
server's, and the module that fills a context from a real filesystem is the
library's, not the command line's. Moving all three closes the two sideways imports
the diagram above shows, and makes the removal legible: after it, what is left
under the agent server's folder is what actually speaks the protocol.

This is not a rename for tidiness. Without it, "remove the agent server from the
command line" reads as though the command line loses the machine it holds between
commands, which is the one thing the host exists for.

### One version, two packages, published in an order that cannot strand a number

A release is warranted when the bundles a user would install differ from the ones
published, and each package's build id answers that for itself. The rule:

```
  either build id differs  →  raise the version once, publish both at it
  neither differs          →  publish nothing, tag nothing
```

Both packages record their own build id, meaning what it means today. The version
is one number because two numbers would invite the question of which library a
command line corresponds to, and the answer is always "the one built beside it".

**Publish the library first, then the command line, then the tag.** The gate reads
the command line's packument, so the command line being present implies both are.
The reverse order leaves a state where the gate says there is nothing to do and the
library was never published. This is the same reasoning that already puts the tag
after the publish rather than before it.

Two consequences the workflow has to carry, both of which only appear after a
partial failure:

- The next version counts from the highest published across *both* packuments, not
  the command line's alone. Counting from one strands a number the other holds.
- A publish refused because that exact version already exists carrying that exact
  build id is a success, not a failure. Otherwise a retry after a partial publish
  wedges on the half that succeeded, and keeps wedging on every push after it.

Removing two operations is breaking. The first release after this raises the minor,
which the existing arrangement already does when a `cli-v…` tag asks for it — the
workflow only ever adds the patch digit itself.

### Where ROMs come from is told to the library, never searched for

`findRomRoot()` walks upward looking for images, which is right for a person who
typed a command in a directory. Loaded from inside somebody else's `node_modules`,
the same walk climbs into their project and answers with whatever it finds. So the
library takes the root as a parameter and does not fall back to the walk. The
command line keeps the walk, keeps the environment variable, and keeps resolving
both to an absolute path before anything crosses to a host.

### The `Dialect` seam is untouched

No member is added, removed or changed, and no dialect changes. The library exports
`Dialect` and `MachineEmulator` as types an embedder reads, which makes the seam
part of a published surface for the first time — recorded here because it raises
the cost of changing it, not because this change alters it.

## Risks / Trade-offs

**Nobody can start either server until the extracted packages exist** → This is
the ordering the change accepts rather than a consequence it overlooked. Between
here and there, an editor or an agent is served only by a program that embeds the
library. The two modified requirements say exactly that, so the specification does
not claim a command that is gone, and the pages telling a reader to run one are
removed rather than left describing it.

**A published surface against a release that raises the patch on every build** →
The workflow adds a patch digit whenever the bundles differ, and a library whose
API can break on a patch is a broken promise. The surface test is the tripwire:
changing what is exported fails it, and passing it deliberately means saying so in
the same change and pushing a tag that raises the minor.

**The library carries the browser editor** → Unavoidable while completion sources
are built at module scope. It is bundled, so it is bytes rather than a dependency
an embedder resolves, and it is the same weight the host and the machine worker
already carry.

**The `Dialect` seam becomes public** → An embedder can hold a `MachineEmulator`,
so a member added or changed is now visible outside the repository. Nothing here
prevents changing it; the cost is that it becomes a versioned decision.

**Declaration emit may not hold** → Settled first, before anything else depends on
it, because the fallback adds a dependency and that needs a licence check.

**The command line's bundle changes shape in the same release as the split** →
Removing the two servers moves the build id, so the first release publishes both
packages and a new address. That is correct — it is a different program — but it
means an installation from before the release cannot reach a host from after it,
which is the behaviour the address exists to produce and not a regression.

## Migration Plan

Nothing to migrate for the library: it is new, and nothing depends on it.

For the command line, the break is real and one-way. A user who starts an editor's
server or an agent's from `basically` finds those operations gone after upgrading,
with the minor version saying so. There is no shim and no deprecation period,
because a command that warned and then did nothing would be worse than one that is
absent from the help.

The release itself is the existing path with one step added ahead of it: the
library is published before the command line, on the same version, and the tag is
written after both. The registry organisation, the trusted publisher and the
workflow's filename are already configured, and the workflow is extended rather
than renamed — the registry matches its filename as part of deciding whether to
trust it.

Rolling back is deprecating the version and letting the next push supersede it, as
before. The repository depends on neither package, so nothing here breaks either
way.

## Open Questions

- Whether the page on embedding joins the docs sidebar. Adding a page does not
  imply adding it, so it is asked separately — together with the same question
  still open on the installation page.
- Whether `lib` is the right last word in the package's name, against `core`. It
  is the plainer of the two and the one this change proceeds with.
