## Why

The headless tool is called `run-listing`, takes its machine as a bare positional
argument, and will only read a program from stdin — a shape that made sense while
running a listing and reporting the screen was the only thing it did. It is about
to be packaged and published, at which point its name and its argument grammar
become a public interface rather than a contributor convenience, and neither
survives the promotion. Nothing in `openspec/specs/` describes the tool at all, so
there is also nothing that says what it guarantees.

Meanwhile the three operations people most want from it outside the browser —
tell me about a machine, check this listing, turn this listing into a file the
machine can load — are already available behind the `Dialect` seam and reachable
only through the browser IDE.

## What Changes

- **BREAKING (the headless tool's invocation only):** the tool is renamed from
  `run-listing` to `basically`, and its work is organised as named subcommands
  rather than a single implied one. The old name is not kept as an alias; it is a
  contributor script, named in only one document.
- **A program is named as a file argument**, with `-` or omission still reading
  stdin, so piping a listing in keeps working under the new verb.
- **`basically machines`** lists every registered machine, optionally as JSON,
  reporting for each whether its ROM is present.
- **`basically info <machine>`** describes one machine: its RAM budget for
  programs, the rules its BASIC imposes, its keywords, the formats it can be built
  to and imported from.
- **`basically lint <file> -m <machine>`** reports a listing's problems without
  running it — no emulator, no ROM.
- **`basically build <file> -m <machine> -o <out>`** writes the listing as the real
  transfer format the machine loads, choosing the format from the output name or an
  explicit target.
- **`basically run`** keeps today's behaviour with clearer flags: `--screenshot`
  replaces `--png` and the positional `png` mode word, `--screen-text` names what
  was the unspoken default, and the two may be asked for together.
- **Stream and exit-code discipline across every subcommand**: stdout carries only
  the product, stderr every figure and notice; `0` means it worked, `1` that the
  caller asked for something impossible, `2` that the program is at fault.
- **The subcommands that need no machine never look for a ROM**, which is what lets
  a ROM-less package still describe machines, lint and build.

## Non-goals

- **Packaging and publishing.** No `bin` entry, no `files` list, no version flag,
  no npm metadata. This change shapes the interface that the packaging change will
  publish; it does not publish it.
- **Driving a running machine.** `run --keys` and `basically test --spec` need an
  input schedule inside the run loop and a key-name-to-machine mapping for every
  registered machine; they are proposed separately in
  `drive-a-machine-from-the-command-line`.
- **Reading a machine's binaries back.** `basically convert` is proposed separately
  in `convert-programs-from-the-command-line`.
- **A public documentation page.** The tool is described to contributors until it
  is something the public can install. The documentation sidebar is untouched.
- **Memory blocks in a build.** Nothing headless has a source of blocks to pass.

## Capabilities

### New Capabilities

- `headless-cli`: what the command line offers outside the browser — the
  operations it names, what each reports, how a caller reads its output by machine,
  and what its exit codes mean.

### Modified Capabilities

None. Every operation reads members of the machine seam that already exist and are
already specified; nothing about the toolchain's behaviour changes, only who can
ask for it.

## Impact

**The command line.** The entry script and the single-purpose argument parser
behind it are replaced by a subcommand grammar. The parser and each subcommand's
work move into their own modules under `src/` so they can be unit-tested and, in
the following change, packaged; the script under `scripts/` keeps only the process
concerns — argv, the streams, writing files, the exit code — and the build-when-
stale bundling it does today.

**Behaviour that does not move.** The listing runner stays where it is and keeps
its promise to touch neither the process nor the filesystem beyond ROMs. ROM
location, machine booting, PNG encoding and the headless canvas are reused
unchanged.

**Tests.** New colocated unit tests for the argument grammar and for each new
subcommand's result, including a registry-driven check that every registered
machine can be described. No browser coverage: the capability has no browser.

**Documentation.** The commands section of `CLAUDE.md` learns the new invocations.
