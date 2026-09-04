## Context

The headless tool is two pieces: a shell wrapper that rebuilds an esbuild bundle
when its sources are stale and then execs it, and a bundle entry point that parses
argv, reads a listing from stdin, runs it, and reports. Behind them sits the part
worth keeping: a listing runner that is documented as touching neither the process,
argv, nor the filesystem beyond ROMs, so that a command line and a server could each
wrap it. That split is the design this change extends — it is why `lint`, `build`
and `info` can be added as siblings rather than as branches inside an argument
parser.

The tool's dependency story is deliberate too. The bundle is built by esbuild
rather than run through `vite-node` like the `gen:*` scripts, specifically so the
headless path carries no vite, vite-node or vitest at runtime. The packaging change
that follows depends on that staying true.

See `docs/contributing/architecture.md` for how the seam and the emulators fit
together; this document only says where the command line's own parts go.

## Goals / Non-Goals

**Goals:**

- One name, `basically`, and one grammar: an operation, then its arguments.
- Each operation's work is a pure function that can be unit-tested without a
  process, and can be packaged without dragging the shell wrapper with it.
- The operations that need no machine run with no ROM and no boot, so they stay
  fast and stay useful in an installation that ships without ROMs.
- Predictable streams and exit codes, because the primary caller is a script or an
  agent, not a person reading prose.

**Non-Goals:**

- Packaging metadata of any kind — that is the next change, and this one is shaped
  to make it small.
- Driving a running machine, or reading a machine's binaries back; both are
  proposed separately.
- Any new runtime dependency. Everything the new operations need is already on the
  machine seam.

## Decisions

### Impact on the Dialect / MachineEmulator seam

None. Every operation added here is a new *reader* of members that already exist:
the linter reads the dialect's dry-run lint, the describer reads the program memory
budget, the machine's BASIC rules, its keywords and its declared build targets and
binary imports, and the builder calls a build target that the transfer dialog
already calls. No member is added, changed or widened, and no machine-specific code
is written. If describing a machine turns out to need a fact no dialect declares,
that is a signal to stop and propose the seam change on its own, not to special-case
a machine in the command line.

### The operations live under `src/`, the process concerns stay in `scripts/`

Each operation becomes a module under a new `src/cli/` — argument parsing, machine
listing, machine description, linting, building — returning plain data and throwing
the runner's existing error type for a caller's mistake. The script under
`scripts/headless/` shrinks to a shim: read argv, read stdin, call the operation,
write files, choose the stream, set the exit code.

This is the same split the listing runner already uses, extended one level up, and
it buys three things: the parser and every operation get colocated unit tests under
the normal `src/**/*.test.ts` convention; the packaging change can ship built `src`
code without the developer wrapper; and the argument grammar stops being reachable
only by spawning a process.

*Alternative rejected: grow the existing entry point into a subcommand switch.* It
keeps everything in one file, but leaves the grammar untestable except through a
spawned process, and leaves the packaging change with a `scripts/`-shaped artifact
to publish.

*Alternative rejected: put the new modules beside the listing runner in the
dialect folder.* Describing a machine and parsing arguments are not dialect work,
and the folder is named for the seam it wraps.

### The shell wrapper is renamed, not aliased

Only one document and the script itself name `run-listing`, so a compatibility
alias would outlive its usefulness immediately and would then have to be explained
in the packaging change. The wrapper keeps exactly what it does today — rebuild the
bundle when its sources are newer, then exec it, passing everything through — and
changes only its name and the tag on its progress notice.

### A program is a file argument, with the pipe kept as a fallback

The published shape has to be `basically lint prog.bas`, but the piped form is what
every existing invocation and habit uses, and it costs one branch to keep. A path
of `-`, or no path, reads standard input. The machine moves off the first
positional slot onto `-m/--machine` so that the file can have it; the machine stays
positional for describing a machine, where there is no file to compete with it.

### Streams are split by whether the caller asked for it

Standard output carries the product and nothing else: the screen's text, the
structured data, the problems a check found. Everything about how the work went —
figures, timings, the missing-ROM notice, the emulator's own chatter, which paths a
build wrote — goes to standard error. The existing entry point already does this
for running (it diverts the emulator's logging so that ROM chatter cannot land in
the screen text) and the rule simply becomes universal.

Checking a program is the one case worth naming: its problems are its product, so
they go to standard output, not to standard error where a compiler would put them.
A caller that pipes the check somewhere wants the problems, and has the exit code
to tell it whether they mattered.

### Three exit codes, meaning three different things

Zero is success. One is the caller's mistake — an option that does not exist, an
unreadable file, a machine that is not registered — and is what the runner's
existing error type already maps to. Two is the program's fault: a fatal problem
found while checking, building or running. This is the distinction a script needs,
and keeping "your program is broken" out of the same code as "your command line is
broken" is the whole point of having more than one non-zero code.

### The build target is chosen by name, then by extension, then by default

A caller may name the target outright. Failing that, the extension of the output
file is matched against what each of the machine's targets declares it produces —
which is the natural thing to write and needs no lookup table, since every target
already declares its extension. Failing that, the machine's first declared target
is used, and which one was chosen is reported. Where a target yields more than one
file, the first goes where the caller asked and the rest are written beside it
under their own names, so that the caller's path always means something.

### Describing a machine has a readable form and a complete form

The structured form carries everything, including each keyword's kind, signature
and documentation — that is what an agent writing BASIC for the machine wants, and
it is the form the requested interface asks for by name. The readable form is a
summary with the keywords listed as bare words, because a machine's full keyword
table is not something a person reads in a terminal.

## Risks / Trade-offs

**Renaming the invocation breaks every habit and script that used the old one** →
The blast radius is genuinely one document plus the script; the rename lands with
that document updated in the same change, and the change is explicitly the moment
to do it, before the name is published and the cost multiplies.

**Moving the parser under `src/` puts command-line code in the type-checked,
linted, tested tree, where strict settings apply** → That is the point, but it does
mean the new modules must be free of unused symbols and must not reach for
`process` or the filesystem. Keeping them pure is what makes them testable, so the
constraint and the goal agree.

**A machine description is only as complete as what the machines declare** → Some
facts a caller might want are optional on the seam and absent for some machines. A
registry-driven test that every registered machine yields a complete description is
what keeps this honest: it will fail loudly on a machine that declares nothing
rather than silently reporting an empty field.

**Building headlessly exercises a path whose only caller has been the browser** →
Build targets produce blobs for download. Reading a blob's bytes in node is
ordinary, and the export round-trip harness already calls build targets outside the
browser, so this is a second caller of a proven path rather than a new one.
